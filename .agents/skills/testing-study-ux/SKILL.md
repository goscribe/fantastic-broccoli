---
name: testing-study-ux
description: Test the study-session UX (workspaces, study plans, activities, copilot) in fantastic-broccoli, in demo mode or against goscribe/server. Use when verifying study flow, data-layer wiring, or UI changes.
---

# Testing the Study UX (fantastic-broccoli)

## Run modes
- **Demo mode (default)**: leave `NEXT_PUBLIC_API_URL` unset. All data comes from `src/lib/mock-data.ts` via the data layer in `src/lib/api/study.ts` (which falls back to mocks when `isLiveApi` is false). No auth or DB needed.
- **Live mode**: set `NEXT_PUBLIC_API_URL` to a running goscribe/server URL. Requires Postgres + server secrets; the `studySession.create` route is plan-gated (`limitedProcedure`), so a free-tier account may be blocked — that is expected pricing behavior, not a bug.

## Commands
- `npm install && npm run dev` → localhost:3000
- Verify: `npm run lint` and `npm run build` (Next 16; read `node_modules/next/dist/docs/` before editing — APIs may differ from training data).

## Key UI paths (demo data)
- Study tab: `/workspace/ws-1/study` — resume card + session list; "New session" opens a 2-step wizard (title → depth/duration → Generate plan). In demo mode create returns the sample session `ses-1` and navigates there.
- Session page: `/workspace/ws-1/session/ses-1` — plan sidebar (Learn/Practice/Recall), Skip advances activities, message icon opens Session notes, copilot is a split pane (X closes, "Ask Scribe" pill reopens).
- Plan extension: click a late activity (7/8) → "keep the momentum?" banner → "Continue plan" appends 3 precomputed activities (8 → 11, time updates).

## Gotchas
- Data now flows through react-query (`fetchStudySessions`, `fetchStudySession`, mutations in `src/lib/api/study.ts`); if pages show empty lists or a stuck "Loading session…", suspect the data layer/`isLiveApi` detection rather than the components.
- Demo-mode mutations (comments, activity status) are local/no-op; persistence across reloads only works in live mode.
- The dev server may already be running from a previous step — check `curl localhost:3000` before starting another.

## Devin Secrets Needed
- None for demo mode. Live mode needs goscribe/server `DATABASE_URL` and its auth/Stripe secrets (not currently provisioned).
