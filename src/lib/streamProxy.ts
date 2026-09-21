// Utility to handle conditional proxying for movies and web series:
// 1. Direct HTTP links -> always proxied via configured proxy (e.g. https://lb3.hdsj.store:2053/?url=) to prevent browser Mixed Content block.
// 2. Direct HTTPS links -> ALWAYS direct without proxy! Player gets original direct link first.
// 3. Live TV (/live/, .m3u8, etc.) and embeds -> NEVER proxied.

// Clear any previous redirect cache so stale entries don't force proxy onto HTTPS streams
if (typeof window !== 'undefined') {
  try {
    sessionStorage.removeItem('iptv_known_http_redirects');
  } catch (e) {
    // Ignore storage errors
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

export const isKnownHttpRedirect = (_url: string): boolean => {
  // HTTPS streams should never be pre-flagged as proxy targets
  return false;
};

export const markUrlAsHttpRedirect = (_url: string): void => {
  // No-op: Do not pollute future plays; every stream starts with its original direct link
};

export const checkIfStreamRedirectsToHttp = async (_url: string): Promise<boolean> => {
  // Do not intercept or pre-proxy HTTPS streams before the player attempts playback
  return false;
};

/**
 * Synchronous URL resolver with smart proxying logic:
 * - Keeps live streams direct
 * - Wraps http:// streams with proxy (mixed content prevention)
 * - Pure https:// streams are direct without proxy!
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
    if (actualMediaUrl.startsWith('http://')) {
      return `${activeProxy}${actualMediaUrl}`;
    }
    return actualMediaUrl;
  }

  // STRICT RULE: Only wrap if link is pure http://
  if (trimmed.startsWith('http://')) {
    return `${activeProxy}${trimmed}`;
  }

  // Pure HTTPS -> Direct stream without proxy!
  return trimmed;
};
