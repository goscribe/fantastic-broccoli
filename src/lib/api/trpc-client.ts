import { createTRPCClient, httpBatchLink, httpLink, splitLink, type TRPCLink } from "@trpc/client";
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

const withCredentials = (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, credentials: "include" });

/**
 * Requests that must not wait for anything else. A batch answers when its
 * slowest query does, so the notification bell (opened while a page is still
 * loading a session or a plan) sat on skeletons for as long as that query
 * took. These go out on their own; everything else is still batched.
 */
const UNBATCHED = /^notifications\./;

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
    splitLink({
      condition: (op) => UNBATCHED.test(op.path),
      true: httpLink({ url: `${apiUrl}/trpc`, transformer: superjson, fetch: withCredentials }),
      false: httpBatchLink({ url: `${apiUrl}/trpc`, transformer: superjson, fetch: withCredentials }),
    }),
  ],
});

export const fetchAuthSession = () => api.auth.getSession.query();
export const fetchPlans = () => api.payment.getPlans.query();
export const createCheckoutSession = (planId: string) =>
  api.payment.createCheckoutSession.mutate({ planId });
