/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Base URL of the Canopy backend that hosts the `/converter` API used by
   * "Import legacy screen…". e.g. `http://localhost:8000` against a locally-run
   * Canopy. Unset disables the live converter flow (a clear error is surfaced).
   */
  readonly VITE_CANOPY_BASE_URL?: string;
  /**
   * API key for the Canopy backend, sent as `X-API-Key`. The `/converter` route
   * is guarded by `require_read_access`. Put the real value in a gitignored
   * `.env.local`, never in `.env.example`.
   */
  readonly VITE_CANOPY_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
