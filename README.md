# cf-fetch-proxy

Cloudflare Worker based HTTP fetch proxy built with Hono. It accepts a target URL, validates it, applies bearer authentication, fetches the upstream response, and returns it with a few hop-by-hop headers removed.

## What it does

- Protects the proxy route with bearer auth.
- Validates the `url` query parameter with Zod.
- Blocks private and localhost-style targets.
- Forwards the upstream response back to the caller.
- Adds proxy debug headers like `x-proxy-status` and `x-proxy-url`.

## Routes

- `GET /` returns a simple health response.
- `GET /proxy?url=https://example.com` fetches the target URL.

## Requirements

- Bun
- A Cloudflare account
- A `PROXY_SECRET` value for bearer authentication

## Local development

Install dependencies:

```bash
bun install
```

Create a local secret for development in `.dev.vars`:

```env
PROXY_SECRET=your-secret-value
```

Run the Worker locally:

```bash
bun run dev
```

## Example request

```bash
curl -H "Authorization: Bearer your-secret-value" \
  "http://127.0.0.1:8787/proxy?url=https%3A%2F%2Fexample.com"
```

## Deploy

Deploy to Cloudflare Workers:

```bash
bun run deploy
```

If you are setting the secret on Cloudflare directly, use Wrangler secrets:

```bash
wrangler secret put PROXY_SECRET
```

## Notes

- This proxy is for legitimate upstreams that allow automated access.
- Some sites still return `403` if they use anti-bot or Cloudflare challenge pages.
- If an upstream is protected, prefer an official API or an allowed machine-access path.