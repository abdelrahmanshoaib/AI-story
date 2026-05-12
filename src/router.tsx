import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { createClientOnlyFn } from "@tanstack/react-start";
import { routeTree } from "./routeTree.gen";

const installServerFnAuthFetch = createClientOnlyFn(async () => {
  const globalWithFlag = globalThis as typeof globalThis & {
    __serverFnAuthFetchInstalled?: boolean;
  };

  if (globalWithFlag.__serverFnAuthFetchInstalled) return;
  globalWithFlag.__serverFnAuthFetchInstalled = true;

  const originalFetch = globalThis.fetch.bind(globalThis);

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    if (url.includes("/_serverFn/")) {
      const { supabase } = await import("./integrations/supabase/client");
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
});

if (typeof window !== "undefined") {
  void installServerFnAuthFetch();
}

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
