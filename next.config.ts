import type { NextConfig } from "next";
import { zendeskWidgetKey } from "./src/lib/zendesk-config";

const isDevelopment = process.env.NODE_ENV !== "production";

function configuredBackofficeOrigin(value: string | undefined) {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.origin
      : null;
  } catch {
    return null;
  }
}

function configuredHttpsOrigin(value: string | undefined) {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.origin
      : null;
  } catch {
    return null;
  }
}

const connectSources = ["'self'"];
if (isDevelopment) connectSources.push("ws:", "wss:");
const backofficeOrigins = new Set(
  [
    process.env.NEXT_PUBLIC_BACKOFFICE_BASE_URL,
    process.env.NEXT_PUBLIC_BACKOFFICE_ENDPOINT_SESSION,
    process.env.NEXT_PUBLIC_BACKOFFICE_ENDPOINT_BOOTSTRAP,
    process.env.NEXT_PUBLIC_BACKOFFICE_ENDPOINT_LOGIN,
    process.env.NEXT_PUBLIC_BACKOFFICE_ENDPOINT_REGISTER,
    process.env.NEXT_PUBLIC_BACKOFFICE_ENDPOINT_LOGOUT,
    process.env.NEXT_PUBLIC_BACKOFFICE_ENDPOINT_CATALOG,
    process.env.NEXT_PUBLIC_BACKOFFICE_ENDPOINT_PLAYS,
    process.env.NEXT_PUBLIC_BACKOFFICE_ENDPOINT_TRADITIONAL_PLAYS,
    process.env.NEXT_PUBLIC_BACKOFFICE_ENDPOINT_INSTANT_PLAYS,
    process.env.NEXT_PUBLIC_BACKOFFICE_ENDPOINT_RESULTS,
    process.env.NEXT_PUBLIC_BACKOFFICE_ENDPOINT_TICKET,
    process.env.NEXT_PUBLIC_BACKOFFICE_ENDPOINT_WALLET_MOVEMENTS,
    process.env.NEXT_PUBLIC_BACKOFFICE_ENDPOINT_WALLET_TOPUP,
  ]
    .map(configuredBackofficeOrigin)
    .filter((origin): origin is string => Boolean(origin)),
);
connectSources.push(...backofficeOrigins);

const frameSources = new Set([
  "'self'",
  "https://www.youtube.com",
  "https://www.youtube-nocookie.com",
]);
[
  process.env.NEXT_PUBLIC_DRAW_STREAM_TEMPRANERO_URL,
  process.env.NEXT_PUBLIC_DRAW_STREAM_MATUTINO_URL,
  process.env.NEXT_PUBLIC_DRAW_STREAM_VESPERTINO_URL,
  process.env.NEXT_PUBLIC_DRAW_STREAM_NOCTURNO_URL,
]
  .map(configuredHttpsOrigin)
  .filter((origin): origin is string => Boolean(origin))
  .forEach((origin) => frameSources.add(origin));

// Zendesk Messaging's documented custom CSP sources, enabled only with a widget key.
const zendeskEnabled = Boolean(zendeskWidgetKey);
const zendeskSources = zendeskEnabled
  ? " https://*.zdassets.com https://*.zendesk.com https://*.smooch.io https://*.sentry.io https://*.twilio.com"
  : "";
if (zendeskEnabled) {
  connectSources.push(...zendeskSources.trim().split(" "), "wss://*.zendesk.com", "wss://api.smooch.io", "wss://voice-js.roaming.twilio.com");
  frameSources.add("https://*.zendesk.com");
  frameSources.add("https://*.smooch.io");
}

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}${zendeskSources}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${zendeskEnabled ? " https://static.zdassets.com https://*.zendesk.com https://media.smooch.io https://*.zdusercontent.com https://www.gravatar.com" : ""}`,
  `font-src 'self' data:${zendeskEnabled ? " https://static.zdassets.com" : ""}`,
  `media-src 'self' data: blob:${zendeskEnabled ? " https://static.zdassets.com" : ""}`,
  `frame-src ${[...frameSources].join(" ")}`,
  `connect-src ${connectSources.join(" ")}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  ...(
    isDevelopment
      ? []
      : [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ]
  ),
];

const nextConfig: NextConfig = {
  agentRules: false,
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
