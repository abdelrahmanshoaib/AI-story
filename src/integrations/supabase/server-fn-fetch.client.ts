// Attaches the current Supabase access token to all server-function fetches.
import { supabase } from "./client";

const originalFetch = globalThis.fetch.bind(globalThis);

let installed = false;
export function installServerFnAuthFetch() {
  if (installed) return;
  installed = true;

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
        ? input.toString()
        : input.url;

    if (url && url.includes("/_serverFn/")) {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) {
        const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
        if (!headers.has("authorization")) {
          headers.set("authorization", `Bearer ${token}`);
        }
        return originalFetch(input, { ...init, headers });
      }
    }
    return originalFetch(input, init);
  };
}

installServerFnAuthFetch();
