/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly API_URL?: string
  readonly DEBUG_MODE?: string
  readonly GIT_REV?: string
  readonly MOBILE_CALLBACK_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.webp' {
  const src: string
  export default src
}
