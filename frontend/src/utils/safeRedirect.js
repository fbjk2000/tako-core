/**
 * Returns `path` only when it is a safe internal route:
 *   - must be a non-empty string
 *   - must start with "/" (absolute path)
 *   - must NOT start with "//" (protocol-relative URL, e.g. //evil.com)
 *   - must NOT contain a protocol scheme (e.g. https: or javascript:)
 *
 * Guards against open-redirect attacks where `location.state.from`
 * or a stored return-path has been tampered with.
 *
 * Falls back to `fallback` (default: "/dashboard") for anything unsafe.
 */
export function safeInternalPath(path, fallback = '/dashboard') {
  if (
    typeof path === 'string' &&
    path.length > 0 &&
    path.startsWith('/') &&
    !path.startsWith('//') &&
    !/[a-z][a-z0-9+\-.]*:/i.test(path)
  ) {
    return path;
  }
  return fallback;
}
