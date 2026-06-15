/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** Production backend origin, e.g. https://api.example.com (no trailing slash) */
  readonly VITE_API_URL?: string;
  /** Chrome extension ID from chrome://extensions (dev unpacked) */
  readonly VITE_ONETAP_EXTENSION_ID?: string;
  /** Set to "1" to log auth header presence (never logs tokens) */
  readonly VITE_DEBUG_AUTH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
