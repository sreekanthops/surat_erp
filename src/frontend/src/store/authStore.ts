import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Group {
  id: string;
  name: string;
}

interface User {
  id: string;
  name: string;
  username: string;
  phone?: string | null;
  email?: string | null;
  role: string;
  tenant: { id: string; name: string; plan: string };
  group: Group;
}

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  setAuth: (token: string, refreshToken: string, user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      user: null,
      setAuth: (token, refreshToken, user) => set({ token, refreshToken, user }),
      logout: () => set({ token: null, refreshToken: null, user: null }),
    }),
    { name: 'textile-auth' }
  )
);
