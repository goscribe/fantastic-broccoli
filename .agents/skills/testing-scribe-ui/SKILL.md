---
name: testing-scribe-ui
description: Test the Scribe study UX (fantastic-broccoli) end-to-end — demo mode and live tRPC wiring. Use when verifying UI changes, backend wiring, or study session flows.
---

# Testing the Scribe study UX

## Modes
- **Demo mode** (default when `NEXT_PUBLIC_API_URL` is unset): every function in `src/lib/api/*.ts` checks `isLiveApi` and serves in-memory mock data. All UI flows are testable without any backend. Note: `src/lib/api/config.ts` may now throw if `NEXT_PUBLIC_API_URL` is unset — if so, use a local mock tRPC server instead (a plain Node http server answering `/trpc/<path>` with superjson-serialized `{result:{data}}`, e.g. on port 4600, and run `NEXT_PUBLIC_API_URL=http://localhost:4600 npm run dev`).
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
- When testing reading highlights against a mock server, implement `studySession.addHighlight` in the mock — the UI adds highlights optimistically and rolls them back if the mutation errors, which can look like a highlighting bug when it's really a missing mock endpoint.
- To reach a session **debrief** against the mock: `mock-trpc.js` ships a `studySession.get` fixture (ses-1, 2 READING activities). Open `/workspace/ws-1/session/ses-1` and click "Done reading"/"Skip" on both activities → debrief renders after the ~3s "Putting together your debrief" stages. Activity statuses aren't persisted by the mock, so revisiting the page resets to activity 1 (re-skip to get back to the debrief).
- Session dates come over the wire as superjson `Date`s — `mapSession` calls `.toISOString()` on them. Mock responses for `studySession.get` must include superjson meta (`{json, meta:{values:{startDate:["Date"],createdAt:["Date"],updatedAt:["Date"]}}}`); the mock's `__superjson` escape hatch in `respond()` handles this. Plain ISO strings without meta crash the session page.
- To trigger the FirstSessionOnboarding overlay: run the mock with `EMPTY=1` (workspace.getTree returns no workspaces) and clear `localStorage["scribe_first_session_onboarding_skip"]`, then reload `/`. The dashboard hero "resumable" state comes from the mock's `studySession.list` fixture for ws-1 (ACTIVE, progress>0).
- UI locale switching for i18n checks: Settings → Language grid (or `localStorage["scribe.locale"]`). Works fully client-side against the mock; remember to switch back to English afterwards.
- LaTeX/KaTeX rendering must be checked in EVERY content path separately (worksheet prompts via `MarkdownText`, reading paragraphs/headings/lists in `reading-activity.tsx`, bank previews via `ReadingBody`) — one path working doesn't prove the others.
- Highlight offsets are raw-text offsets; math renders inside `data-math-len` spans so selection mapping stays aligned. To regression-test, highlight a phrase in a paragraph that also contains math and check the mark covers exactly the selected characters.
- LLM-authored HTML visualizers render in `sandbox="allow-scripts"` iframes (`html-widget.tsx`); test by seeding a figure `{id, type:"html", title, html}` and a `[[figure:ID]]` token in the reading. Self-contained inline HTML/SVG/JS is the reliable path; CDN scripts may not load.
- `html-widget.tsx` may inject the Tailwind Play CDN with design tokens mapped as color names (bg-accent, text-violet, ...). To adversarially test that injection, seed fixture markup styled ONLY with Tailwind classes (no inline CSS) — if injection is broken it renders as plain unstyled text. Note the CDN needs network access; strict CSP/offline environments fall back to unstyled classes while CSS-var styling keeps working.
- Copilot custom visualizations (`visualizations: [{title, html}]` from `copilot.ask`) render through the same `HtmlWidget` as reading figures, so one rendering test covers both paths; the copilot-specific part to verify is the embed mapping in `copilot.tsx`.
- `themeStyle()` in `html-widget.tsx` may inject a mini design system into the iframe (`.card`, `.viz-row`, `.viz-controls`, `.viz-stat`/`.viz-stat-value`, `.viz-badge`, `.text-small`, `.text-muted`, styled native buttons/selects, `button[aria-pressed=true]` accent state). Test the injection the same adversarial way as Tailwind: seed fixture markup using ONLY these classes — broken injection shows unstyled text/default browser buttons. Unlike the Tailwind CDN, these need no network.
- Prompt-only changes (server copilot prompt, inference figure schema) can't be proven with mock fixtures — always report LLM output quality as untested until a live generation after deploy.
- **Asset-only commits (replaced PNGs under `public/illustrations/`) can render STALE even after a browser hard reload**: the Next dev server keeps an on-disk image-optimizer cache at `.next/dev/cache/images/` (not `.next/cache/images/`) keyed per width/quality/format, and serves `X-Nextjs-Cache: HIT` for old renders. To bust it: kill the dev server (`pkill -f next-server` — the process is named `next-server`, so `pkill -f "next dev"` misses it), `rm -rf .next/dev/cache/images`, restart, then hard-reload the browser. Verify server-side with `curl -H "Accept: image/webp" "http://localhost:3000/_next/image?url=<encoded path>&w=64&q=75"` and checking dominant pixel color with PIL before trusting screenshots.

## Devin Secrets Needed
- None for demo mode.
- For live mode (not yet provisioned): `DATABASE_URL` (Postgres), Supabase service key, Pusher app credentials, plus a deployed goscribe/server URL for `NEXT_PUBLIC_API_URL`.
