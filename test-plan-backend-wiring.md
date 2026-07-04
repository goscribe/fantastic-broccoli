# Test Plan — Full backend wiring (PR #1, demo-mode fallback)

## Context
Everything now goes through the tRPC data layer (`src/lib/api/{auth,workspace,materials,study,copilot}.ts`).
With `NEXT_PUBLIC_API_URL` unset (this environment) the layer serves demo data — if wiring is broken,
pages render empty/stuck/redirect states instead of the previous data.

Live-API mode (running goscribe/server + Postgres/Supabase/Pusher) is NOT testable here: no secrets.
Declared untested in the report.

## Environment
- Dev server: localhost:3000 (demo mode)
- Evidence: recording + screenshots

## Tests

### T1 — Login page (auth wiring, demo mode)
1. Go to `/login`.
- PASS: standalone login card (no sidebar/topbar), demo-mode banner text "Demo mode — no backend configured",
  button reads "Continue in demo mode"; clicking it navigates to `/`. FAIL: redirect loop, app shell visible, or error.

### T2 — Home + folder pages fetch workspace tree (workspace.ts path)
1. On `/`, verify greeting shows ", Alan" and folder cards render (e.g. "IB Diploma").
2. Click a folder → `/folder/[id]` shows subfolders/workspaces with breadcrumb.
- PASS: data renders via fetchWorkspaceTree (not blank). FAIL: empty page / "not found".

### T3 — Sidebar Shared tab + mobile sidebar
1. In sidebar, switch to "Shared with me" tab → shared workspaces list (with sharer name).
2. Resize window to mobile width (~390px): sidebar hidden; hamburger in top bar opens slide-in sidebar
   with backdrop; navigating closes it.
- PASS: both behaviors as described. FAIL: tab shows nothing, or sidebar always visible / cannot open on mobile.

### T4 — Materials upload + analysis status (materials.ts path)
1. Go to `/workspace/ws-1/materials`, click Upload, pick a small file.
- PASS: upload button shows spinner, then an analysis status card renders step list
  (Uploading file → Parsing document → Generating study materials → Precomputing artifact bank)
  progressing to "Analysis complete". FAIL: nothing happens or error text.

### T5 — Session page: activities flow + plan extension from bank
1. Open a session; verify plan sidebar + first activity render (not "Loading session…").
2. Click a late activity → "keep the momentum?" prompt appears; click "Continue plan".
- PASS: plan grows (8 → 11 items) with appended worksheet/MCQ items (extensions now come via
  `fetchExtensionActivities`, demo branch). FAIL: prompt missing or no items appended.

### T6 — Copilot chats (copilot.ts demo branch)
1. In session, copilot pane open by default at ~25% width; send a prompt → scripted response streams.
2. Click "+" → new "Chat 2" tab becomes active with empty thread; switch back to Chat 1 → history intact.
- PASS: per-tab message isolation works. FAIL: messages leak across tabs or send does nothing.

### T7 — Notes persist via mutation path
1. Open notes panel, add "integration test note".
- PASS: note appears with timestamp; hover shows delete; deleting removes it. FAIL: input clears, no note.

### Untested (declared)
- Live tRPC calls (auth.login, workspace.uploadFiles signed URLs, Pusher progress, studySession.pullFromBank,
  copilot.ask) — no backend deployable here. Contracts verified by types/build only.
