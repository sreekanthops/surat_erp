import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { z } from 'zod';
import { prisma } from '../services/db.js';
import { signToken, signRefreshToken, verifyToken } from '../services/jwt.js';
import { authMiddleware } from '../middleware/auth.js';

export const authRouter = Router();

// Helper to create mailer transporter from environment or fallback
function createTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

// Login format: "groupname/username"
const loginSchema = z.object({
  login:    z.string().min(3).refine(v => v.includes('/'), { message: 'Login must be in format groupname/username' }),
  password: z.string().min(1),
});

// POST /api/v1/auth/login
authRouter.post('/login', async (req, res, next) => {
  try {
    const { login, password } = loginSchema.parse(req.body);

    const slashIdx  = login.indexOf('/');
    const groupName = login.slice(0, slashIdx).trim().toLowerCase();
    const username  = login.slice(slashIdx + 1).trim().toLowerCase();

    if (!groupName || !username) {
      return res.status(400).json({ error: 'Login must be in format groupname/username', code: 'AUTH_000' });
    }

    // Find group by name (case-insensitive) within any active tenant
    const group = await prisma.group.findFirst({
      where: { name: { equals: groupName, mode: 'insensitive' }, isActive: true },
      include: { tenant: { select: { id: true, name: true, plan: true, isActive: true } } },
    });

    if (!group) {
      return res.status(401).json({ error: 'Invalid credentials', code: 'AUTH_001' });
    }

    if (!group.tenant.isActive) {
      return res.status(403).json({ error: 'Workspace is suspended. Contact your administrator.', code: 'AUTH_002' });
    }

    // Find user by username within that group
    const user = await prisma.user.findFirst({
      where: {
        groupId:  group.id,
        username: { equals: username, mode: 'insensitive' },
      },
    });

    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid credentials', code: 'AUTH_001' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials', code: 'AUTH_001' });

    if (!user.isActive) return res.status(403).json({ error: 'Account inactive. Contact your administrator.', code: 'AUTH_003' });

    const token        = signToken({ userId: user.id, tenantId: user.tenantId, role: user.role, groupId: user.groupId ?? undefined });
    const refreshToken = signRefreshToken({ userId: user.id });

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    return res.json({
      token,
      refreshToken,
      user: {
        id:       user.id,
        name:     user.name,
        username: user.username,
        phone:    user.phone,
        role:     user.role,
        tenant:   group.tenant,
        group:    { id: group.id, name: group.name },
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/auth/me
authRouter.get('/me', async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, name: true, username: true, phone: true, email: true, role: true, isActive: true,
        tenant: { select: { id: true, name: true, plan: true, isActive: true } },
        group:  { select: { id: true, name: true } },
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json(user);
  } catch (err) { next(err); }
});

// POST /api/v1/auth/refresh
authRouter.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

    const payload = verifyToken(refreshToken) as any;
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { tenant: true },
    });

    if (!user) return res.status(401).json({ error: 'User not found' });

    const newToken = signToken({ userId: user.id, tenantId: user.tenantId, role: user.role, groupId: user.groupId ?? undefined });
    return res.json({ token: newToken });
  } catch {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// PUT /api/v1/auth/profile — Any logged-in user can update their personal email & phone
const updateProfileSchema = z.object({
  name:  z.string().min(1).optional(),
  phone: z.string().optional().nullable(),
  email: z.string().email('Please enter a valid email address'),
});

authRouter.put('/profile', authMiddleware, async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const body = updateProfileSchema.parse(req.body);

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(body.name && { name: body.name }),
        phone: body.phone ?? undefined,
        email: body.email.toLowerCase().trim(),
      },
      select: {
        id: true, name: true, username: true, phone: true, email: true, role: true,
        tenant: { select: { id: true, name: true, plan: true, isActive: true } },
        group:  { select: { id: true, name: true } },
      },
    });

    return res.json({ ok: true, user: updated, message: 'Profile and email updated successfully!' });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/forgot-password — Request temporary password sent to user's configured email
const forgotPassSchema = z.object({
  login: z.string().min(3).refine(v => v.includes('/'), { message: 'Login must be in format groupname/username' }),
});

authRouter.post('/forgot-password', async (req, res, next) => {
  try {
    const { login } = forgotPassSchema.parse(req.body);

    const slashIdx  = login.indexOf('/');
    const groupName = login.slice(0, slashIdx).trim().toLowerCase();
    const username  = login.slice(slashIdx + 1).trim().toLowerCase();

    const group = await prisma.group.findFirst({
      where: { name: { equals: groupName, mode: 'insensitive' }, isActive: true },
    });
    if (!group) {
      return res.status(404).json({ error: `Group "${groupName}" not found.` });
    }

    const user = await prisma.user.findFirst({
      where: {
        groupId: group.id,
        username: { equals: username, mode: 'insensitive' },
      },
    });

    if (!user) {
      return res.status(404).json({ error: `User "${username}" not found in group "${groupName}".` });
    }

    if (!user.email) {
      return res.status(400).json({
        error: `No recovery email configured for this account. Please ask your group Owner or Manager (${groupName}) to set your email or reset your password.`,
      });
    }

    // Generate random 8-character temporary password
    const tempPassword = `Tx!${crypto.randomBytes(4).toString('hex')}`;
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    // Send email via nodemailer
    const transporter = createTransporter();
    let emailSent = false;

    if (transporter) {
      try {
        await transporter.sendMail({
          from: `"GSpaces TextileIQ Security" <${process.env.SMTP_USER}>`,
          to: user.email,
          subject: '🔐 Your TextileIQ Temporary Password',
          text: `Hello ${user.name},\n\nA password reset was requested for your account (${login}).\n\nYour temporary password is:\n${tempPassword}\n\nPlease login using:\nLogin: ${login}\nPassword: ${tempPassword}\n\nWe recommend changing your password after logging in from Settings > Profile.\n\nBest regards,\nGSpaces TextileIQ`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e4e7ef; border-radius: 12px; background: #ffffff;">
              <h2 style="color: #111827; margin-top: 0;">🔐 Password Reset</h2>
              <p style="color: #4b5563; font-size: 14px;">Hello <strong>${user.name}</strong>,</p>
              <p style="color: #4b5563; font-size: 14px;">A temporary password has been generated for your account <code>${login}</code>.</p>
              <div style="background: #f4f6fb; padding: 16px; border-radius: 8px; border: 1.5px dashed #5b5bd6; text-align: center; margin: 20px 0;">
                <span style="font-size: 13px; color: #6b7280; display: block; margin-bottom: 6px;">Your Temporary Password</span>
                <strong style="font-size: 20px; letter-spacing: 2px; color: #5b5bd6;">${tempPassword}</strong>
              </div>
              <p style="color: #6b7280; font-size: 13px;">Please sign in with this temporary password and update it in your Profile settings immediately.</p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
              <p style="color: #9ca3af; font-size: 11px; margin-bottom: 0;">GSpaces TextileIQ Security · Surat, India</p>
            </div>
          `,
        });
        emailSent = true;
      } catch (mailErr: any) {
        console.error('[Forgot Password Mail Error]', mailErr?.message || mailErr);
      }
    }

    // Masked email for display: e.g. s***h@example.com
    const emailParts = user.email.split('@');
    const maskedName = emailParts[0].length > 2
      ? `${emailParts[0][0]}***${emailParts[0][emailParts[0].length - 1]}`
      : `${emailParts[0][0]}***`;
    const maskedEmail = `${maskedName}@${emailParts[1]}`;

    return res.json({
      ok: true,
      emailSent,
      maskedEmail,
      message: emailSent
        ? `A temporary password has been sent to your registered email (${maskedEmail}).`
        : `Password reset successfully. (SMTP not configured on server: your temporary password is: ${tempPassword})`,
    });
  } catch (err) {
    next(err);
  }
});
