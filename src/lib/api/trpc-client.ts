import { createTRPCClient, httpBatchLink, type TRPCLink } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import type { AppRouter } from "@goscribe/server";
import superjson from "superjson";
import { apiUrl } from "./config";
import { surfaceRefusal } from "./refusals";

/** Surfaces plan-limit and other refusals of key mutations (see refusals.ts). */
const refusalLink: TRPCLink<AppRouter> = () => ({ op, next }) =>
  observable((observer) =>
    next(op).subscribe({
      next: (value) => observer.next(value),
      error: (err) => {
        if (op.type === "mutation") {
          const code = (err as { data?: { code?: string } | null }).data?.code;
          surfaceRefusal(op.path, err.message, code ?? undefined);
        }
        observer.error(err);
      },
      complete: () => observer.complete(),
    }),
  );

/**
 * Typed tRPC client for the published goscribe/server router
 * (auth, workspace, payment/pricing, materials, …).
 *
 * The studySession router is newer than the published @goscribe/server
 * types — see study-session.ts for its typed client.
 */
export const api = createTRPCClient<AppRouter>({
  links: [
    refusalLink,
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
