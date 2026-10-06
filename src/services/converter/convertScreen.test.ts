import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { convertScreen, ConverterError, type ScreenConversionResultDTO } from './convertScreen';

const DTO: ScreenConversionResultDTO = {
  screen: {
    schemaVersion: '1.0',
    kind: 'screen',
    id: 's',
    metadata: { title: 's', source: { type: 'edl-converter' }, size: { width: 1, height: 1 } },
    macros: [],
    root: {
      id: 'w-001',
      type: 'absolute-canvas',
      props: {},
      geometry: { x: 0, y: 0, width: 1, height: 1 },
      children: [],
    },
  },
  warnings: [],
  unknownWidgets: [],
  formulas: [],
  stats: { widgetCount: 0, macroCount: 0, ruleCount: 0 },
};

function file(name = 'panel.edl'): File {
  return new File(['<edl/>'], name, { type: 'application/octet-stream' });
}

describe('convertScreen', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_CANOPY_BASE_URL', 'http://localhost:8000');
    // Clear any ambient key (e.g. from .env.local) so each test starts keyless.
    vi.stubEnv('VITE_CANOPY_API_KEY', '');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('POSTs multipart form data with the file and returns the DTO', async () => {
    const fetchMock = vi.fn(async (url: URL | string, init?: RequestInit) => {
      expect(String(url)).toBe('http://localhost:8000/converter/v1/conversions');
      expect(init?.method).toBe('POST');
      const body = init?.body as FormData;
      expect(body.get('file')).toBeInstanceOf(File);
      // kind not forced → omitted (server infers from suffix)
      expect(body.get('kind')).toBeNull();
      return new Response(JSON.stringify(DTO), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await convertScreen(file());
    expect(result.stats.widgetCount).toBe(0);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('sends the X-API-Key header when configured', async () => {
    vi.stubEnv('VITE_CANOPY_API_KEY', 'dev');
    const fetchMock = vi.fn(async (_url, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>)['X-API-Key']).toBe('dev');
      return new Response(JSON.stringify(DTO), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    await convertScreen(file());
  });

  it('omits the X-API-Key header when not configured', async () => {
    const fetchMock = vi.fn(async (_url, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>)['X-API-Key']).toBeUndefined();
      return new Response(JSON.stringify(DTO), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    await convertScreen(file());
  });

  it('forwards an explicit kind', async () => {
    const fetchMock = vi.fn(async (_url, init?: RequestInit) => {
      expect((init?.body as FormData).get('kind')).toBe('ui');
      return new Response(JSON.stringify(DTO), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    await convertScreen(file('panel.ui'), { kind: 'ui' });
  });

  it('maps a CanopyError envelope to a ConverterError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ error: { code: 'UnsupportedInput', message: 'bad file' } }),
            { status: 400 }
          )
      )
    );
    await expect(convertScreen(file())).rejects.toMatchObject({
      name: 'ConverterError',
      code: 'UnsupportedInput',
      message: 'bad file',
      status: 400,
    });
  });

  // The deployed build sets the base URL to a same-origin path that nginx
  // proxies (adding X-API-Key server-side), so the prefix must survive.
  it('preserves a path-only base URL, resolved against the page origin', async () => {
    vi.stubEnv('VITE_CANOPY_BASE_URL', '/screen-builder/canopy');
    const fetchMock = vi.fn(async (url: URL | string) => {
      expect(String(url)).toBe(
        `${window.location.origin}/screen-builder/canopy/converter/v1/conversions`
      );
      return new Response(JSON.stringify(DTO), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    await convertScreen(file());
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('preserves a path prefix on an absolute base URL', async () => {
    vi.stubEnv('VITE_CANOPY_BASE_URL', 'https://example.test/canopy');
    const fetchMock = vi.fn(async (url: URL | string) => {
      expect(String(url)).toBe('https://example.test/canopy/converter/v1/conversions');
      return new Response(JSON.stringify(DTO), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    await convertScreen(file());
  });

  it('tolerates a trailing slash on the base URL', async () => {
    vi.stubEnv('VITE_CANOPY_BASE_URL', 'http://localhost:8000/');
    const fetchMock = vi.fn(async (url: URL | string) => {
      expect(String(url)).toBe('http://localhost:8000/converter/v1/conversions');
      return new Response(JSON.stringify(DTO), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    await convertScreen(file());
  });

  it('throws NoBaseUrl when the env var is unset', async () => {
    vi.stubEnv('VITE_CANOPY_BASE_URL', '');
    await expect(convertScreen(file())).rejects.toMatchObject({
      name: 'ConverterError',
      code: 'NoBaseUrl',
    });
  });

  it('exposes ConverterError as the thrown type', async () => {
    vi.stubEnv('VITE_CANOPY_BASE_URL', '');
    const err = await convertScreen(file()).catch((e) => e);
    expect(err).toBeInstanceOf(ConverterError);
  });
});
