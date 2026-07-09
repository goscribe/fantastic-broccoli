import { createTRPCMsw, httpLink } from "msw-trpc";
import type { AppRouter } from "@goscribe/server";
import { http, HttpResponse } from "msw";
import superjson from "superjson";
import type {
  ApiArtifactBankItem,
  ApiStudySession,
} from "@/lib/api/study-session";

/** Must match NEXT_PUBLIC_API_URL in vitest.config.mts. */
export const testApiUrl = "http://test-api.local";

/**
 * Typed MSW handlers for every procedure in the published goscribe/server
 * AppRouter. Handler return values are statically checked against the
 * router's inferred output types, so schema drift fails compilation.
 *
 * Usage: `trpcMsw.workspace.getTree.query(() => fixture)`
 */
export const trpcMsw = createTRPCMsw<AppRouter>({
  links: [httpLink({ url: `${testApiUrl}/trpc` })],
  transformer: { input: superjson, output: superjson },
});

// ---------------------------------------------------------------------------
// The studySession router is newer than the published @goscribe/server types
// (see src/lib/api/study-session.ts), so msw-trpc can't infer it. These
// helpers mirror the client's contracts so fixtures stay statically typed;
// fold them into trpcMsw once the published AppRouter includes the router.
// ---------------------------------------------------------------------------

interface StudySessionQueryOutputs {
  "studySession.list": ApiStudySession[];
  "studySession.get": ApiStudySession;
  "studySession.listBank": ApiArtifactBankItem[];
  "studySession.activityCalendar": { date: string; count: number }[];
}

export function studySessionQuery<P extends keyof StudySessionQueryOutputs>(
  path: P,
  resolver: (input: unknown) => StudySessionQueryOutputs[P],
) {
  return http.get(`${testApiUrl}/trpc/${path}`, ({ request }) => {
    const raw = new URL(request.url).searchParams.get("input");
    const input = raw
      ? superjson.deserialize(JSON.parse(raw))
      : undefined;
    return HttpResponse.json({
      result: { data: superjson.serialize(resolver(input)) },
    });
  });
}
