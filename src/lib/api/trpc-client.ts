import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@goscribe/server";
import superjson from "superjson";
import { apiUrl } from "./config";

/**
 * Typed tRPC client for the published goscribe/server router
 * (auth, workspace, payment/pricing, materials, …).
 *
 * The studySession router is newer than the published @goscribe/server
 * types — see study-session.ts for its typed client.
 */
export const api = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${apiUrl}/trpc`,
      transformer: superjson,
      fetch(input, init) {
        return fetch(input, { ...init, credentials: "include" });
      },
    }),
  ],
});

export const fetchAuthSession = () => api.auth.getSession.query();
export const fetchPlans = () => api.payment.getPlans.query();
export const createCheckoutSession = (planId: string) =>
  api.payment.createCheckoutSession.mutate({ planId });
