/**
 * Target/endpoint URL validation, shared by the config schema and the HTTP
 * layers as the exporter's SSRF guard (see `REQ-SEC-4`).
 *
 * Kept in its own module so it can be imported by the config schema
 * ([`configSchema.ts`](./configSchema.ts)), the per-request check in
 * [`server.ts`](./server.ts), and the fetch-boundary re-validation in
 * [`exporter.ts`](./exporter.ts) without coupling those to the config module.
 */

const ALLOWED_TARGET_SCHEMES = new Set(["http:", "https:"]);

/**
 * Validate a target/endpoint URL before it is used for an HTTP request, and
 * return it as a parsed `URL` object.
 *
 * It must be a parseable absolute URL using an `http:`/`https:` scheme; any
 * other scheme (`file:`, `gopher:`, …) or an unparseable value throws. This
 * mitigates SSRF from the operator-supplied endpoint and the `?target=` query
 * parameter. Callers should use the returned `URL` (or pass it straight to
 * `fetch`) so the value used for the network request is the validated one.
 */
export function validateUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`invalid target URL: ${rawUrl}`);
  }
  if (!ALLOWED_TARGET_SCHEMES.has(url.protocol)) {
    throw new Error(`disallowed target URL scheme: ${url.protocol}`);
  }
  return url;
}
