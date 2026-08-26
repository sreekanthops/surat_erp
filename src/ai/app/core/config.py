from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # OpenRouter (replaces OpenAI direct)
    openrouter_api_key: str = ""
    openrouter_model: str = "openai/gpt-4o"

    # Legacy OpenAI fields kept for backward compatibility
    openai_api_key: str = ""
    openai_model: str = "gpt-4o"

    pinecone_api_key: str = ""
    pinecone_environment: str = "us-east-1-aws"
    pinecone_index_name: str = "textile-messages"
    database_url: str = ""
    redis_url: str = "redis://localhost:6379"

    class Config:
        env_file = ".env"
        extra = "allow"


settings = Settings()
