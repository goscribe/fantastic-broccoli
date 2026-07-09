import { studySessionQuery, trpcMsw } from "./trpc-msw";
import {
  activityCalendar,
  bankItems,
  chemSession,
  chemWorkspace,
  sessionUser,
  workspaceTree,
} from "./fixtures";

/** Default handlers backing every test; override per-test with server.use(). */
export const handlers = [
  trpcMsw.auth.getSession.query(() => sessionUser),
  trpcMsw.workspace.getTree.query(() => workspaceTree),
  trpcMsw.workspace.get.query(() => chemWorkspace),
  studySessionQuery("studySession.list", () => [chemSession]),
  studySessionQuery("studySession.get", () => chemSession),
  studySessionQuery("studySession.listBank", () => bankItems),
  studySessionQuery("studySession.activityCalendar", () => activityCalendar),
];
