import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { zValidator } from "@hono/zod-validator";
import * as z from "zod";

type Bindings = {
  PROXY_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Blocked unsafe hosts (internal networks etc.)
const BLOCKED_HOSTS = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "169.254.",
  "10.",
  "192.168.",
  "172.16.",
];

function isSafeTarget(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }
    const host = url.hostname.toLowerCase();
    return !BLOCKED_HOSTS.some((blocked) => host.startsWith(blocked));
  } catch {
    return false;
  }
}

// Zod validation schema
const targetSchema = z.url("Invalid URL format").refine(isSafeTarget, {
  message: "Unsafe or private target URL not allowed",
});

const proxyQuerySchema = z.object({
  url: targetSchema,
});

app.use(
  "/proxy/*",
  bearerAuth({
    verifyToken: (token, c) => token === c.env.PROXY_SECRET,
    realm: "cf-fetch-proxy",
  }),
);

app.get("/", (c) =>
  c.json({ status: "ok", message: "Welcome to CF Fetch Proxy!" }),
);

app.get(
  "/proxy",
  bearerAuth({
    verifyToken: (token, c) => token === c.env.PROXY_SECRET,
    realm: "cf-fetch-proxy",
  }),
  zValidator("query", proxyQuerySchema),
  async (c) => {
    const { url: validatedUrl } = c.req.valid("query");

    try {
      const upstreamResponse = await fetch(validatedUrl, {
        method: "GET",
        headers: c.req.raw.headers,
        redirect: "follow",
      });

      // Strip problematic headers
      const responseHeaders = new Headers(upstreamResponse.headers);
      [
        "content-encoding",
        "transfer-encoding",
        "connection",
        "cf-ray",
        "server",
      ].forEach((header) => {
        responseHeaders.delete(header);
      });

      responseHeaders.set("x-proxy-status", upstreamResponse.status.toString());
      responseHeaders.set("x-proxy-url", upstreamResponse.url);

      return new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        headers: responseHeaders,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: "Upstream fetch failed", message }, 502);
    }
  },
);

export default app;
