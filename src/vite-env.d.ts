/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OPENAI_API_KEY: string
  readonly VITE_CLAUDE_API_KEY: string
  readonly VITE_GEMINI_API_KEY: string
  readonly VITE_LOCAL_LLM_ENDPOINT: string
  readonly VITE_APP_NAME: string
  readonly VITE_APP_VERSION: string
  readonly VITE_APP_DESCRIPTION: string
  readonly VITE_DEBUG_MODE: string
  readonly VITE_LOG_LEVEL: string
  readonly VITE_ENABLE_API_KEY_ENCRYPTION: string
  readonly VITE_MAX_PROMPT_LENGTH: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
