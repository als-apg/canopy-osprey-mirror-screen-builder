// HTTP client for Canopy's `/converter` API (PR #41).
//
// Uploads a legacy `.edl`/`.ui` file and gets back a validated screen IR
// document plus server-side diagnostics. We do NOT parse `.edl`/`.ui` in the
// browser — that's the converter's job; this just calls it.

import type { ScreenJSON } from '@slaclab/canopy-screen-ir';

/**
 * The `ScreenConversionResultDTO` returned by `POST /converter/v1/conversions`
 * (camelCase on the wire). `screen` is the document to feed `importScreenJSON`;
 * the diagnostic arrays are server-side and richer than client-derived ones.
 */
export interface ScreenConversionResultDTO {
  screen: ScreenJSON;
  warnings: string[];
  unknownWidgets: { originalClass: string; count: number }[];
  formulas: { name: string; expression: string }[];
  stats: { widgetCount: number; macroCount: number; ruleCount: number };
}

/** A converter API failure, carrying the `CanopyError` envelope's code. */
export class ConverterError extends Error {
  readonly code: string;
  readonly status?: number;
  constructor(code: string, message: string, status?: number) {
    super(message);
    this.name = 'ConverterError';
    this.code = code;
    this.status = status;
  }
}

export interface ConvertScreenOptions {
  /** Force the input kind when the filename suffix is ambiguous. */
  kind?: 'edl' | 'ui';
  /** Abort the in-flight request (e.g. on a timeout or user cancel). */
  signal?: AbortSignal;
}

const CONVERSIONS_PATH = '/converter/v1/conversions';

/**
 * Convert one legacy screen file to a screen IR document via Canopy.
 *
 * Reads the backend base URL from `VITE_CANOPY_BASE_URL`. Throws
 * `ConverterError` on a missing base URL or any non-2xx response (the
 * `CanopyError` envelope's message is surfaced).
 */
export async function convertScreen(
  file: File,
  opts: ConvertScreenOptions = {}
): Promise<ScreenConversionResultDTO> {
  const base = import.meta.env.VITE_CANOPY_BASE_URL;
  if (!base) {
    throw new ConverterError(
      'NoBaseUrl',
      'VITE_CANOPY_BASE_URL is not configured; cannot reach the converter API.'
    );
  }

  const form = new FormData();
  form.append('file', file);
  // Omit `kind` when not forced — the server infers it from the filename suffix.
  if (opts.kind) form.append('kind', opts.kind);

  // The converter route is guarded by `require_read_access` (X-API-Key). Send
  // the key when configured; absent, the server returns a 401 we surface.
  const headers: Record<string, string> = {};
  const apiKey = import.meta.env.VITE_CANOPY_API_KEY;
  if (apiKey) headers['X-API-Key'] = apiKey;

  let res: Response;
  try {
    // Do NOT set Content-Type — the browser sets the multipart boundary.
    res = await fetch(new URL(CONVERSIONS_PATH, base), {
      method: 'POST',
      body: form,
      headers,
      signal: opts.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ConverterError(
      'NetworkError',
      `Could not reach the converter at ${base}: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (!res.ok) throw await toConverterError(res);
  return (await res.json()) as ScreenConversionResultDTO;
}

/** Map a non-2xx response (a `CanopyError` envelope) to a `ConverterError`. */
async function toConverterError(res: Response): Promise<ConverterError> {
  let code = 'ConversionFailed';
  let message = `Converter returned ${res.status} ${res.statusText}`;
  try {
    const body = (await res.json()) as {
      error?: { code?: string; message?: string };
      code?: string;
      message?: string;
    };
    const env = body.error ?? body;
    if (env.code) code = env.code;
    if (env.message) message = env.message;
  } catch {
    // Non-JSON body — keep the status-line fallback.
  }
  return new ConverterError(code, message, res.status);
}
