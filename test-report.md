# Test Report — Full backend wiring (fantastic-broccoli PR #1)

Ran the frontend locally at localhost:3000 in **demo mode** (`NEXT_PUBLIC_API_URL` unset) and exercised every rewired flow end-to-end via GUI recording.

## Important caveat
**Live tRPC calls were NOT tested** — there is no deployed goscribe/server, Postgres, Supabase, or Pusher available in this environment. Everything below verifies the demo-mode branch of the data layer plus the UI flows; the live branches (auth.login, workspace.uploadFiles signed URLs, Pusher analysis progress, studySession.pullFromBank, copilot.ask) are verified only by typecheck/build against server#5's contracts.

## Results

- **T1 — Login page (demo mode)**: PASSED. Standalone card (no app shell), "Demo mode — no backend configured" banner, "Continue in demo mode" navigates to home.
- **T2 — Home + folder pages fetch workspace tree**: PASSED. Greeting "Good evening, Alan", folder cards render; entering IB Diploma shows breadcrumb + subfolders (Sciences, Mathematics).
- **T3 — Shared tab + mobile sidebar**: PASSED. Shared tab lists Physics HL (Maya) and English Lang & Lit (Daniel). At ~500px width the sidebar hides, hamburger opens a slide-in panel, and navigating auto-closes it.
- **T4 — Materials upload**: PASSED (demo gating) / **UNTESTED (live)**. Demo mode correctly refuses upload with "Uploads require a configured backend (NEXT_PUBLIC_API_URL)" instead of faking progress. The signed-URL upload + Pusher analysis steps could not be exercised without a backend.
- **T5 — Plan extension from artifact bank**: PASSED. "Keep the momentum?" prompt near plan end; Continue plan appended 3 balanced items (2 worksheets + 1 quiz), plan 8 → 11, header time 51m → 1h 5m.
- **T6 — Copilot multi-chat**: PASSED. Prompt streams a reply with embedded IE graph; "+" opens empty Chat 2; switching back to Chat 1 restores history. (Demo scripted responses; live copilot.ask untested.)
- **T7 — Session notes**: PASSED. "integration test note" saved with Today stamp; hover trash deletes it. (In-memory in demo; SessionComment persistence untested live.)

## Evidence

| T1 — Login (demo banner) | T2 — Home greeting + folders |
|---|---|
| ![login](/home/ubuntu/screenshots/ss_cf113f1e.png) | ![home](/home/ubuntu/screenshots/ss_4baba1aa.png) |

| T2 — Folder page breadcrumb | T3 — Shared tab |
|---|---|
| ![folder](/home/ubuntu/screenshots/ss_996aa951.png) | ![shared](/home/ubuntu/screenshots/ss_5adb2b90.png) |

| T3 — Mobile: sidebar hidden | T3 — Mobile: slide-in open |
|---|---|
| ![mobile-closed](/home/ubuntu/screenshots/ss_512409e0.png) | ![mobile-open](/home/ubuntu/screenshots/ss_f0457e1c.png) |

| T4 — Demo upload gating notice | T5 — Extension prompt |
|---|---|
| ![upload-gate](/home/ubuntu/screenshots/ss_ed1a09a1.png) | ![extension-prompt](/home/ubuntu/screenshots/ss_1b324af5.png) |

| T5 — Plan 8 → 11 after Continue | T6 — Copilot graph reply |
|---|---|
| ![plan-extended](/home/ubuntu/screenshots/ss_eeef8718.png) | ![copilot](/home/ubuntu/screenshots/ss_bf90a640.png) |

| T7 — Note added | T7 — Note deleted |
|---|---|
| ![note-added](/home/ubuntu/screenshots/ss_6a9ee375.png) | ![note-deleted](/home/ubuntu/screenshots/ss_f74c3d4c.png) |

## Recording
Full annotated run: attached as rec-6a3a2075-...-edited.mp4.
