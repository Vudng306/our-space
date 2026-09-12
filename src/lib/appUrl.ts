import { headers } from "next/headers";
import { env } from "./env";

/**
 * Where this instance is actually reachable.
 *
 * `NEXT_PUBLIC_APP_URL` wins when it is set, because a custom domain is
 * something only the operator knows. When it is not, the incoming request
 * already carries the answer — which spares a first deploy the chicken-and-egg
 * step of having to know its own address before it has one, and stops invite
 * links quietly pointing at localhost.
 */
export async function resolveAppUrl(): Promise<string> {
  if (env.appUrlConfigured) return env.appUrl;

  try {
    const h = await headers();
    // Hosts put the real address in x-forwarded-host; `host` is the fallback.
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) {
      const proto =
        h.get("x-forwarded-proto") ??
        (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
      return `${proto}://${host}`.replace(/\/$/, "");
    }
  } catch {
    // Called outside a request (a script, a build step) — fall through.
  }

  return env.appUrl;
}
