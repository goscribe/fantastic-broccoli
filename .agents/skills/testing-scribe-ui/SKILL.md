---
name: testing-scribe-ui
description: Test the Scribe study UX (fantastic-broccoli) end-to-end — demo mode and live tRPC wiring. Use when verifying UI changes, backend wiring, or study session flows.
---

# Testing the Scribe study UX

## Modes
- **Demo mode** (default when `NEXT_PUBLIC_API_URL` is unset): every function in `src/lib/api/*.ts` checks `isLiveApi` and serves in-memory mock data. All UI flows are testable without any backend.
- **Live mode**: set `NEXT_PUBLIC_API_URL` to a running goscribe/server. Requires Postgres, Supabase, and Pusher credentials — without them, live-branch tests must be declared untested.

## Setup
1. `cd fantastic-broccoli && npm run dev` (localhost:3000). Build check: `npx tsc --noEmit && npm run lint && npm run build`.
2. Maximize Chrome (`wmctrl -r :ACTIVE: -b add,maximized_vert,maximized_horz`) before recording.

## Core flows to verify
- `/login`: demo banner + "Continue in demo mode" → home. Live: real email/password via `auth.login`.
- Home `/`: greeting includes user name; folder cards from `fetchWorkspaceTree`. Click folder → `/folder/[id]` breadcrumb + subfolders.
- Sidebar: "My library" / "Shared" tabs; Shared lists sharer names.
- Mobile: resize window to ~500px (`xdotool getactivewindow windowsize 500 900`); hamburger opens slide-in sidebar; navigation auto-closes it.
- Materials `/workspace/ws-1/materials`: in demo mode, Upload shows "Uploads require a configured backend" — this is intentional gating, not a bug. Live upload (signed Supabase URL + Pusher analysis steps) needs a backend.
- Session `/workspace/ws-1/session/ses-1`: click a late plan item (e.g. #7) → "keep the momentum?" prompt; Continue plan appends 3 bank items (plan 8→11, time updates).
- Copilot pane: send a suggested prompt → scripted/streamed reply with embeds; "+" makes an isolated new chat tab.
- Notes: open notes panel (comment icon in header), Enter saves; delete button is opacity-0 until hover — hover the note row, trash icon is at far right of the timestamp row.

## Gotchas
- The note delete trash icon may not show in screenshots (group-hover opacity); click its known position at the right edge of the note's timestamp row anyway — it is still clickable.
- After resizing the window with xdotool/wmctrl, the browser may lose focus — click inside the page before using ctrl+l, and prefer in-app links over address-bar navigation at small widths.
- Demo highlights/notes are in-memory and reset on refresh; don't treat that as a persistence bug in demo mode.
- ws-1/ses-1 are the richest demo fixtures; other workspaces have fewer sessions.

## Devin Secrets Needed
- None for demo mode.
- For live mode (not yet provisioned): `DATABASE_URL` (Postgres), Supabase service key, Pusher app credentials, plus a deployed goscribe/server URL for `NEXT_PUBLIC_API_URL`.
