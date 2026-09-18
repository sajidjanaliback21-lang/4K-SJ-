// Utility to handle conditional proxying for movies and web series:
// 1. Direct HTTP links -> always proxied via configured proxy (e.g. https://lb3.hdsj.store:2053/?url=)
// 2. Pure HTTPS links -> direct without proxy for maximum speed and zero proxy overhead
// 3. HTTPS links that redirect to HTTP -> detected either preflight or on playback error,
//    and the FIRST link is wrapped through our proxy!
// 4. Live TV (/live/, .m3u8, etc.) and embeds -> NEVER proxied

const HTTP_REDIRECT_CACHE_KEY = 'iptv_known_http_redirects';

// In-memory set of URLs or hosts that redirect from HTTPS to HTTP
const inMemoryHttpRedirectSet = new Set<string>();

// Load from sessionStorage if available in browser
if (typeof window !== 'undefined') {
  try {
    const stored = sessionStorage.getItem(HTTP_REDIRECT_CACHE_KEY);
    if (stored) {
      const list = JSON.parse(stored);
      if (Array.isArray(list)) {
        list.forEach(u => inMemoryHttpRedirectSet.add(u));
      }
    }
  } catch (e) {
    // Ignore storage parse errors
  }
}

export const getActiveVideoProxy = (): string => {
  if (typeof window === 'undefined') return 'https://lb3.hdsj.store:2053/?url=';
  const custom = (window as any).activeVideoProxyUrl || (window as any).appSettingsDefaultProxyUrl;
  if (custom && typeof custom === 'string' && custom.trim() && custom.trim() !== 'N/A') {
    const trimmed = custom.trim();
    return trimmed.endsWith('=') ? trimmed : (trimmed.includes('?') ? `${trimmed}&url=` : `${trimmed}?url=`);
  }
  return 'https://lb3.hdsj.store:2053/?url=';
};

export const isLiveOrManifestUrl = (url: string): boolean => {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase();
  return (
    lower.includes('/live/') ||
    lower.includes('.m3u8') ||
    lower.includes('.mpd') ||
    lower.includes('.ts')
  );
};

export const isKnownHttpRedirect = (url: string): boolean => {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (inMemoryHttpRedirectSet.has(trimmed)) return true;

  try {
    const parsed = new URL(trimmed);
    // Check if host is known to redirect to HTTP
    if (inMemoryHttpRedirectSet.has(parsed.host) || inMemoryHttpRedirectSet.has(parsed.origin)) {
      return true;
    }
  } catch (e) {
    // URL parsing fallback
  }

  return false;
};

export const markUrlAsHttpRedirect = (url: string): void => {
  if (!url || typeof url !== 'string') return;
  const trimmed = url.trim();
  inMemoryHttpRedirectSet.add(trimmed);

  try {
    const parsed = new URL(trimmed);
    inMemoryHttpRedirectSet.add(parsed.host);
    inMemoryHttpRedirectSet.add(parsed.origin);
  } catch (e) {
    // URL parsing fallback
  }

  if (typeof window !== 'undefined') {
    try {
      const arr = Array.from(inMemoryHttpRedirectSet);
      sessionStorage.setItem(HTTP_REDIRECT_CACHE_KEY, JSON.stringify(arr));
    } catch (e) {
      // Storage quota or permission error
    }
  }
};

/**
 * Pre-detects if an HTTPS stream redirects to an insecure HTTP URL.
 * Returns true if it is HTTP or redirects to HTTP.
 */
export const checkIfStreamRedirectsToHttp = async (url: string): Promise<boolean> => {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();

  // If already pure HTTP, return true immediately
  if (trimmed.startsWith('http://')) {
    return true;
  }

  // If already known from memory/session cache
  if (isKnownHttpRedirect(trimmed)) {
    return true;
  }

  // If it's a live stream or embed, never proxy
  if (isLiveOrManifestUrl(trimmed)) {
    return false;
  }

  // Pre-check via server check-redirect endpoint
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);

    const res = await fetch(`/api/check-redirect?url=${encodeURIComponent(trimmed)}`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.redirectsToHttp) {
        markUrlAsHttpRedirect(trimmed);
        return true;
      }
    }
  } catch (e) {
    // If timeout or error, do not block; return false and let player runtime fallback handle if needed
  }

  return false;
};

/**
 * Synchronous URL resolver with smart proxying logic:
 * - Keeps live streams direct
 * - Wraps http:// streams with proxy
 * - Wraps https:// streams with proxy ONLY if known to redirect to http
 * - Leaves pure https:// streams direct without proxy
 */
export const getSmartStreamUrl = (url: string, isLive?: boolean, skipProxy?: boolean): string => {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  // Never proxy live streams, manifests, or if skipProxy is specified
  if (isLive || skipProxy || isLiveOrManifestUrl(trimmed)) {
    return trimmed;
  }

  const activeProxy = getActiveVideoProxy();

  // If already proxied, return as-is
  if (trimmed.startsWith(activeProxy)) {
    return trimmed;
  }

  // If wrapped by old/different proxy, extract target
  if (trimmed.includes('?url=')) {
    const actualMediaUrl = trimmed.substring(trimmed.indexOf('?url=') + 5);
    if (actualMediaUrl) {
      return `${activeProxy}${actualMediaUrl}`;
    }
  }

  // If front link is HTTP -> ALWAYS PROXY!
  if (trimmed.startsWith('http://')) {
    return `${activeProxy}${trimmed}`;
  }

  // If front link is HTTPS:
  if (trimmed.startsWith('https://')) {
    // If known to redirect to HTTP -> PROXY FIRST LINK!
    if (isKnownHttpRedirect(trimmed)) {
      return `${activeProxy}${trimmed}`;
    }
    // Pure HTTPS -> Direct stream without proxy!
    return trimmed;
  }

  return trimmed;
};
