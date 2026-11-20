// Minimal mock goscribe/server for UI screenshots.
import http from "node:http";

const sj = (json) => ({ json });

const user = {
  id: "u1",
  name: "Demo User",
  email: "demo@scribe.app",
  emailVerified: true,
  profilePicture: null,
  role: null,
};

const workspaces = [
  {
    id: "ws-1",
    title: "Chemistry HL",
    coverUrl: "http://localhost:3000/design/covers/demo-chem.png",
    folderId: null,
    icon: "book",
    color: "green",
    updatedAt: new Date().toISOString(),
    uploads: [
      { id: "up-1", name: "B4 Thermodynamics Guide.pdf", mimeType: "application/pdf", size: 1200000, createdAt: new Date(Date.now() - 86400000 * 3).toISOString(), updatedAt: new Date(Date.now() - 86400000 * 3).toISOString(), analysisStatus: "COMPLETED" },
      { id: "up-2", name: "Energetics worked examples.pdf", mimeType: "application/pdf", size: 800000, createdAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString(), analysisStatus: "COMPLETED" },
    ],
    owner: user,
    members: [],
  },
  {
    id: "ws-2",
    title: "History Paper 2",
    folderId: null,
    icon: "book",
    color: "green",
    updatedAt: new Date().toISOString(),
    uploads: [],
    owner: user,
    members: [],
  },
  {
    id: "ws-3",
    title: "Spanish B Vocab",
    folderId: null,
    icon: "book",
    color: "green",
    updatedAt: new Date().toISOString(),
    uploads: [],
    owner: user,
    members: [],
  },
  {
    id: "ws-4",
    title: "Physics Mechanics",
    folderId: "folder-1",
    icon: "book",
    color: "green",
    updatedAt: new Date().toISOString(),
    uploads: [],
    owner: user,
    members: [],
  },
];

const folders = [
  { id: "folder-1", name: "IB Sciences", color: "#0ea5e9", parentId: null },
  { id: "folder-2", name: "Humanities", color: "#ec4899", parentId: null },
  { id: "folder-abc", name: "Languages", color: "#f59e0b", parentId: null },
];

let wsCounter = 10;
const notesOutlines = {};
const createdSessions = {};

function sessionEnvelope(session) {
  const meta = {
    startDate: ["Date"],
    createdAt: ["Date"],
    updatedAt: ["Date"],
  };
  (session.activities || []).forEach((_, i) => {
    meta[`activities.${i}.createdAt`] = ["Date"];
    meta[`activities.${i}.updatedAt`] = ["Date"];
  });
  return { __superjson: { json: session, meta: { values: meta } } };
}

const organizing = {};
const ORGANIZE_MS = 6000;

// Admin overview trend charts (admin.getTrends). Deterministic made-up numbers;
// the 6m and 1y ranges have no previous period, like a young database.
const TREND_SHAPES = { "3d": [3, 6], "1w": [7, 24], "1m": [28, 24], "3m": [91, 168], "6m": [182, 168], "1y": [364, 168] };
function trendsFixture(range = "1m") {
  const [days, bucketHours] = TREND_SHAPES[range] ?? TREND_SHAPES["1m"];
  const n = (days * 24) / bucketHours;
  const to = Date.now();
  const from = to - days * 86400000;
  const noHistory = days > 91;
  const wave = (i, base, slope, seed) =>
    Math.max(0, Math.round(base + slope * i + base * 0.35 * Math.sin(i * 1.7 + seed)));
  const metric = (key, label, base, slope, extra = {}) => {
    const scale = extra.unit === "percent" ? 1 : bucketHours / 24;
    const all = Array.from({ length: 2 * n }, (_, i) => wave(i, base * scale, (slope * scale) / n, key.length));
    const percent = extra.unit === "percent";
    const total = (a) => (percent ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10 : a.reduce((x, y) => x + y, 0));
    const current = total(all.slice(n));
    const previous = noHistory ? null : total(all.slice(0, n));
    const change =
      previous === null || (!percent && previous === 0)
        ? null
        : percent
          ? { value: Math.round((current - previous) * 10) / 10, kind: "points" }
          : { value: Math.round(((current - previous) / previous) * 1000) / 10, kind: "percent" };
    return {
      key, label, description: `${label} (mock data).`, unit: "count", better: "up", ...extra,
      current, previous, change,
      series: all.slice(n).map((v, i) => (range === "1y" && i < 20 ? null : v)),
      previousSeries: noHistory ? null : all.slice(0, n),
    };
  };
  const json = {
    range, days, bucketHours,
    previousFrom: new Date(from - days * 86400000).toISOString(),
    from: new Date(from).toISOString(),
    to: new Date(to).toISOString(),
    bucketStarts: Array.from({ length: n }, (_, i) => new Date(from + i * bucketHours * 3600000).toISOString()),
    metrics: [
      metric("activeUsers", "Active users", 40, 30),
      metric("returningUsers", "Returning users", 9, -6),
      metric("signups", "Signups", 30, 24),
      metric("activation", "Activation", 27, 6, { unit: "percent" }),
      metric("sessions", "Study sessions", 22, 10),
      metric("activities", "Activities completed", 12, -8),
      metric("uploads", "Uploads", 45, 20),
      metric("flashcards", "Flashcards reviewed", 60, 0),
      metric("copilot", "Copilot messages", 14, 5),
      metric("revenue", "Revenue", 1900, 1500, { unit: "money" }),
      metric("errorRate", "Error rate", 1.2, 1.5, { unit: "percent", better: "down" }),
    ],
  };
  const values = { previousFrom: ["Date"], from: ["Date"], to: ["Date"] };
  json.bucketStarts.forEach((_, i) => (values[`bucketStarts.${i}`] = ["Date"]));
  return { __superjson: { json, meta: { values } } };
}

// Generation assessment (admin.generationEvalSummary). Made-up scores for two runs.
function generationEvalFixture() {
  const DAY = 86400000;
  const run = (id, daysAgo, averages, mediumFlagged) => ({
    runId: id,
    startedAt: new Date(Date.now() - daysAgo * DAY - 40 * 60000).toISOString(),
    finishedAt: new Date(Date.now() - daysAgo * DAY).toISOString(),
    materials: 13,
    assessed: 12,
    failed: 1,
    averages,
    activities: 96,
    mediumFlagged,
    mediumFlaggedPct: Math.round((mediumFlagged / 96) * 1000) / 10,
    mediumIssues: [
      { kind: "needs_drawing", activities: 6 },
      { kind: "hard_to_type", activities: 4 },
      { kind: "too_long_to_type", activities: 3 },
      { kind: "missing_figure", activities: 1 },
    ],
    weakest: [
      { materialKey: "wikipedia-supply-and-demand", title: "Supply and demand", kind: "graph-heavy", overallScore: 4, summary: "Good coverage of the model, but three worksheet parts ask the student to plot curves accurately, which the sketch pad cannot do." },
      { materialKey: "wikibooks-matrices-problem-set", title: "High School Mathematics Extensions: Matrices problem set", kind: "problem-set", overallScore: 5, summary: "Answers are matrices typed as plain text, slow on a laptop and close to impossible on a phone." },
      { materialKey: "wikipedia-hamlet", title: "Hamlet", kind: "literature", overallScore: 6, summary: "Sound questions; two comprehension checks expect essay-length answers." },
    ],
  });
  const values = {};
  for (const k of ["latest", "previous"]) for (const f of ["startedAt", "finishedAt"]) values[`${k}.${f}`] = ["Date"];
  const json = {
    running: false,
    poolSize: 13,
    latest: run("fixture-new", 2, { overall: 6.4, materialFit: 8.3, quality: 7.6, laptopFit: 7.9, phoneFit: 6.4 }, 14),
    previous: run("fixture-old", 9, { overall: 5.8, materialFit: 8.3, quality: 7.4, laptopFit: 7.5, phoneFit: 5.8 }, 19),
  };
  return { __superjson: { json, meta: { values } } };
}

// Weekly cohorts (admin.getWeeklyCohorts). Made-up numbers: the two newest weeks are
// provisional, and only the newest has first-hour pages.
function cohortsFixture(weeks = 8) {
  const DAY = 86400000;
  const now = Date.now();
  const monday = (t) => { const d = new Date(t); const m = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); return m - ((d.getUTCDay() + 6) % 7) * DAY; };
  const first = monday(now);
  const columns = [
    ["verified", "Verified email", "first7Days", 0, 7, 48], ["createdSubject", "Made a subject", "first7Days", 0, 7, 36],
    ["uploaded", "Uploaded", "first7Days", 0, 7, 31], ["startedSession", "Started a session", "first7Days", 0, 7, 27],
    ["completedActivity", "Finished an activity", "first7Days", 0, 7, 17], ["finishedSession", "Finished a session", "first7Days", 0, 7, 16],
    ["paid", "Paid (30 days)", "first7Days", 0, 30, 0.6], ["flashcards", "Flashcards", "used", 0, 7, 16],
    ["copilot", "Copilot", "used", 0, 7, 9], ["planner", "Changed their plan", "used", 0, 7, 2],
    ["week1", "Days 2–7", "cameBack", 1, 7, 4.5], ["week2", "Week 2", "cameBack", 7, 14, 1.8],
    ["week3", "Week 3", "cameBack", 14, 21, 1.1], ["week4", "Week 4", "cameBack", 21, 28, 0.6],
  ];
  const values = { from: ["Date"], to: ["Date"], pageViewsFrom: ["Date"] };
  const cohorts = Array.from({ length: weeks }, (_, i) => {
    const start = first - i * 7 * DAY;
    const end = start + 7 * DAY;
    const signups = i === 0 ? 36 : i === 1 ? 22 : 600 + ((i * 37) % 90);
    const lift = i <= 1 ? 1.35 : 1 + Math.sin(i) * 0.08;
    const cells = {};
    for (const [key, , , fromDay, toDay, base] of columns) {
      if (start + fromDay * DAY >= now) { cells[key] = null; continue; }
      const pct = Math.round(base * lift * 10) / 10;
      cells[key] = { users: Math.round((pct / 100) * signups), pct, partial: end + toDay * DAY > now };
    }
    values[`cohorts.${i}.weekStart`] = ["Date"];
    values[`cohorts.${i}.weekEnd`] = ["Date"];
    return {
      weekStart: new Date(start).toISOString(), weekEnd: new Date(end).toISOString(), inProgress: end > now, signups, cells,
      sessionsPerUser: i <= 1 ? 0.7 : 0.5, activitiesPerUser: 0.2, medianMinutesToFirstSession: i === 1 ? null : 1.9 + (i % 3) * 0.4,
      firstVisit: i === 0 ? {
        partialTracking: true, trackedUsers: 18,
        paths: [
          { pages: ["/"], users: 5, pct: 27.8 },
          { pages: ["/", "/workspace/[id]", "/workspace/[id]/session/[sessionId]"], users: 4, pct: 22.2 },
          { pages: ["/", "/study-bot", "/workspace/[id]/chat"], users: 2, pct: 11.1 },
        ],
        lastPages: [{ page: "/", users: 6, pct: 33.3 }, { page: "/workspace/[id]", users: 4, pct: 22.2 }, { page: "/settings", users: 3, pct: 16.7 }],
      } : null,
    };
  });
  const json = {
    weeks, from: new Date(first - (weeks - 1) * 7 * DAY).toISOString(), to: new Date(now).toISOString(),
    pageViewsFrom: new Date(now - 3 * DAY).toISOString(),
    columns: columns.map(([key, label, group]) => ({ key, label, group })), cohorts,
  };
  return { __superjson: { json, meta: { values } } };
}

function handleProc(path, input) {
  switch (path) {
    case "auth.getSession":
      // ADMIN=1 signs the demo user in as a System Admin so /admin renders.
      if (process.env.ADMIN === "1") return { user: { ...user, role: { name: "System Admin" } } };
      return { user };
    case "admin.getTrends":
      return trendsFixture(input?.range);
    case "admin.generationEvalSummary":
      return generationEvalFixture();
    case "admin.runGenerationEval":
      return { started: true };
    case "admin.getWeeklyCohorts":
      return cohortsFixture(input?.weeks);
    case "workspace.getTree":
      // EMPTY=1 simulates a brand-new user (triggers first-session onboarding).
      if (process.env.EMPTY === "1") return { folders: [], workspaces: [] };
      return { folders, workspaces };
    case "workspace.getNotesOutline": {
      // While organizeNotes is "running" (it answers after ORGANIZE_MS), topics appear one at a time, as on the server.
      const run = organizing[input && input.workspaceId];
      if (run && Date.now() - run.start < ORGANIZE_MS) {
        const n = Math.floor(((Date.now() - run.start) / ORGANIZE_MS) * (run.outline.topics.length + 1));
        if (n > 0) return { ...run.outline, topics: run.outline.topics.slice(0, n), partial: true };
        return run.previous;
      }
      return notesOutlines[input && input.workspaceId] || null;
    }
    case "workspace.organizeNotes": {
      const ws = workspaces.find((w) => w.id === (input && input.workspaceId));
      const ids = ((ws && (ws.uploads || ws.files || ws.materials)) || []).map((f) => f.id);
      const outline = {
        generatedAt: new Date().toISOString(),
        fileCount: ids.length || 1,
        topics: [
          { title: "First law and internal energy", summary: "How heat, work and internal energy are related for an ideal gas.", points: ["The first law is $Q = \\Delta U + W$.", "For a monatomic ideal gas, $\\Delta U = \\frac{3}{2} nR\\,\\Delta T$.", "Work done by the gas is the area under its $pV$ curve."], fileIds: ids.slice(0, 2) },
          { title: "Gas processes", summary: "Isothermal, adiabatic, isobaric and isovolumetric changes.", points: ["In an adiabatic process $Q = 0$ and $pV^{\\gamma}$ is constant.", "In an isothermal process $\\Delta U = 0$, so $Q = W$.", "In an isovolumetric process $W = 0$."], fileIds: ids.slice(0, 1) },
          { title: "Heat engines and efficiency", summary: "Engines turn part of the heat taken in into work; Carnot sets the limit.", points: ["Efficiency is $\\eta = W / Q_h$.", "The Carnot efficiency is $1 - T_c / T_h$.", "A clockwise cycle on a $pV$ diagram gives net work out."], fileIds: ids.slice(1, 3) },
          { title: "Entropy and the second law", summary: "Entropy of an isolated system never decreases.", points: ["Entropy change is $\\Delta S = Q / T$.", "The entropy of an isolated system never decreases."], fileIds: ids.slice(0, 1) },
        ],
      };
      organizing[input.workspaceId] = { start: Date.now(), outline, previous: notesOutlines[input.workspaceId] || null };
      notesOutlines[input.workspaceId] = outline;
      return { __delayMs: ORGANIZE_MS, value: { outline, renamed: 1 } };
    }
    case "workspace.getUploadPreviews":
      return [];
    case "workspace.getSharedWith":
      return { shared: [] };
    case "workspace.create": {
      const id = `ws-new-${wsCounter++}`;
      workspaces.push({
        id,
        title: (input && input.name) || "New workspace",
        folderId: null,
        icon: "book",
        color: "green",
        updatedAt: new Date().toISOString(),
        uploads: [],
        owner: user,
        members: [],
      });
      return { id, title: (input && input.name) || "New workspace" };
    }
    case "workspace.uploadFiles":
      return ((input && input.files) || []).map((f, i) => ({
        fileId: `file-${i}`,
        uploadUrl: `http://localhost:4600/upload/file-${i}`,
      }));
    case "workspace.uploadAndAnalyzeMediaConcurrent":
      return { ok: true };
    case "copilot.createConversation":
      return { id: "conv-1", title: (input && input.title) || "Study bot" };
    case "copilot.listConversations":
      return [];
    case "workspace.get": {
      const id = input && input.id;
      return workspaces.find((w) => w.id === id) || workspaces[0];
    }
    case "studySession.list": {
      if (process.env.EMPTY === "1" || !input || input.workspaceId !== "ws-1")
        return [];
      // One resumable session so the dashboard hero shows the progress block.
      const listAct = (n, title, status) => ({
        id: `act-${n}`,
        sessionId: "ses-1",
        type: "READING",
        title,
        description: null,
        content: { text: "…" },
        order: n,
        status,
        estimatedMinutes: 5,
        timeSpentSeconds: null,
        meta: null,
        highlights: [],
        createdAt: "2026-02-16T10:00:00.000Z",
        updatedAt: "2026-02-16T10:00:00.000Z",
      });
      return {
        __superjson: {
          json: [
            {
              id: "ses-1",
              workspaceId: "ws-1",
              userId: "u1",
              title: "Energetics recap",
              description: "Hess's law and bond enthalpies",
              depth: "MODERATE",
              durationMinutes: 15,
              status: "ACTIVE",
              progress: 40,
              generating: false,
              examBoard: null,
              syllabus: null,
              topics: null,
              startDate: "2026-02-16T10:00:00.000Z",
              endDate: null,
              createdAt: "2026-02-16T10:00:00.000Z",
              updatedAt: "2026-02-16T10:00:00.000Z",
              activities: [
                listAct(0, "Read: Hess's law essentials", "COMPLETED"),
                listAct(1, "Read: Bond enthalpies", "PENDING"),
              ],
              comments: [],
            },
          ],
          meta: {
            values: {
              "0.startDate": ["Date"],
              "0.createdAt": ["Date"],
              "0.updatedAt": ["Date"],
            },
          },
        },
      };
    }
    case "studySession.create": {
      const now = new Date().toISOString();
      const id = `ses-new-${Date.now()}`;
      const title = (input && input.title) || "Study session";
      const topics = (input && input.topics) || "";
      const session = {
        id,
        workspaceId: (input && input.workspaceId) || "ws-1",
        userId: "u1",
        title,
        description: null,
        depth: (input && input.depth) || "MODERATE",
        durationMinutes: (input && input.durationMinutes) || 30,
        status: "ACTIVE",
        progress: 0,
        generating: false,
        examBoard: (input && input.examBoard) || null,
        syllabus: (input && input.syllabus) || null,
        topics: topics || null,
        startDate: now,
        endDate: null,
        createdAt: now,
        updatedAt: now,
        comments: [],
        activities: [
          {
            id: `${id}-act-0`,
            sessionId: id,
            type: "READING",
            title: `Read: ${title}`,
            description: null,
            content: {
              text:
                topics ||
                "Your notes are in. This mock plan is a stand-in until the real generator runs.",
            },
            order: 0,
            status: "PENDING",
            estimatedMinutes: 10,
            timeSpentSeconds: null,
            meta: null,
            highlights: [],
            createdAt: now,
            updatedAt: now,
          },
        ],
      };
      createdSessions[id] = session;
      return sessionEnvelope(session);
    }
    case "studySession.get": {
      const id = (input && input.id) || "ses-1";
      if (createdSessions[id]) return sessionEnvelope(createdSessions[id]);
      const act = (n, title, text) => ({
        id: `act-${n}`,
        sessionId: id,
        type: "READING",
        title,
        description: null,
        content: { text },
        order: n,
        status: "PENDING",
        estimatedMinutes: 5,
        timeSpentSeconds: null,
        meta: null,
        highlights: [],
        createdAt: "2026-02-16T10:00:00.000Z",
        updatedAt: "2026-02-16T10:00:00.000Z",
      });
      return {
        __superjson: {
          json: {
            id,
            workspaceId: "ws-1",
            userId: "u1",
            title: "Energetics recap",
            description: "Hess's law and bond enthalpies",
            depth: "MODERATE",
            durationMinutes: 15,
            status: process.env.DONE ? "COMPLETED" : "ACTIVE",
            progress: process.env.DONE ? 100 : 40,
            generating: false,
            examBoard: null,
            syllabus: null,
            topics: null,
            startDate: "2026-02-16T10:00:00.000Z",
            endDate: null,
            createdAt: "2026-02-16T10:00:00.000Z",
            updatedAt: "2026-02-16T10:00:00.000Z",
            activities: [
              // One COMPLETED reading (drives the cheer pill: completedCount >= 1)
              { ...act(0, "Read: Hess's law essentials",
                "Hess's law states that the total enthalpy change of a reaction is independent of the route taken. Enthalpy is a state function, so cycles let you compute unknown enthalpies from known ones."),
                status: "COMPLETED" },
              // An MCQ activity so correct answers can fire the confetti burst.
              { ...act(1, "Quiz: Hess's law", ""),
                type: "MCQ",
                content: {
                  type: "mcq",
                  questions: [
                    {
                      question: "Hess's law works because enthalpy is a…",
                      options: ["path function", "state function", "rate constant", "unit of heat"],
                      correctIndex: 1,
                      explanation: "Enthalpy depends only on the state, not the route.",
                    },
                    {
                      question: "Bond enthalpy values are…",
                      options: ["exact", "averages over many molecules"],
                      correctIndex: 1,
                      explanation: "Tabulated bond enthalpies are averages, so results are approximate.",
                    },
                  ],
                } },
              // Vocab recall + cloze so their confetti paths are reachable too.
              { ...act(2, "Recall: key terms", ""),
                type: "VOCAB_RECALL",
                content: {
                  type: "vocab_recall",
                  terms: [
                    { term: "Enthalpy", definition: "Heat content of a system at constant pressure.", result: null },
                    { term: "State function", definition: "A property that depends only on the current state.", result: null },
                  ],
                } },
              { ...act(3, "Cloze: fill the blanks", ""),
                type: "CLOZE",
                content: {
                  type: "cloze",
                  passages: [
                    { textWithBlanks: "Hess's law works because enthalpy is a {{blank}} function.", answers: ["state"] },
                  ],
                } },
              act(4, "Read: Bond enthalpies",
                "Bond enthalpy is the energy needed to break one mole of a bond in gaseous molecules. Reaction enthalpy ≈ bonds broken minus bonds formed; values are averages, so results are approximate."),
            ].map((a) => (process.env.DONE ? { ...a, status: "COMPLETED" } : a)),
            comments: [],
          },
          meta: {
            values: {
              startDate: ["Date"],
              createdAt: ["Date"],
              updatedAt: ["Date"],
            },
          },
        },
      };
    }
    case "studySession.updateActivityStatus":
      return { ok: true };
    case "studySession.pullFromBank":
      return [];
    case "studySession.listBank": {
      // DECKS=1: one flashcard deck in ws-1 so /flashcards shows a deck grid.
      if (process.env.DECKS === "1" && input && input.workspaceId === "ws-1")
        return [
          {
            id: "bank-deck-1",
            kind: "FLASHCARD_DECK",
            title: "Energetics key terms",
            topic: "Thermochemistry",
            content: {
              type: "flashcard_review",
              cards: [
                { front: "Define enthalpy", back: "Heat content at constant pressure" },
                { front: "Exothermic ΔH sign?", back: "Negative" },
                { front: "Hess's law", back: "Total ΔH is path-independent" },
              ],
            },
          },
        ];
      return [];
    }
    case "planner.disconnectCalendar":
      return { ok: true };
    case "planner.getPlan":
    case "planner.updatePlan":
      return { dailyGoalMin: 25, examTitle: "Bio Paper 1", examDate: new Date(Date.now() + 23 * 86400000), windowStart: "15:00", windowEnd: "19:00", weekdays: [1, 2, 3, 4, 5, 6, 0], timezone: "UTC" };
    case "flashcards.generateFromPrompt":
      return { artifact: { id: "bank-deck-1", title: input?.title ?? "Flashcards", generating: true } };
    case "flashcards.isGenerating":
      return { generating: false, metadata: null };
    case "planner.replan":
      return { ok: true, source: "ai" };
    case "planner.getWeek": {
      const monday = new Date(); monday.setUTCHours(0, 0, 0, 0); monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
      const ymd = (d) => d.toISOString().slice(0, 10);
      const today = ymd(new Date());
      const busyFor = (i) => (i === 2 ? [{ title: "Football training", start: 960, end: 1050 }] : i === 4 ? [{ title: "Dentist", start: 1020, end: 1080 }] : []);
      const blocksFor = (date, i) => {
        if (date < today || i === 6) return [];
        const list = [
          [{ kind: "review", title: "Flashcards · 12 due", start: 900, end: 915 }, { kind: "session", title: "Energetics — bond enthalpies", start: 925, end: 970, sessionId: "ses-1", workspaceId: "ws-1", why: "most left to cover" }],
          [{ kind: "session", title: "Thermodynamics — short answers", start: 900, end: 945, sessionId: "ses-1", workspaceId: "ws-1" }],
          [{ kind: "session", title: "Energetics — Hess's law", start: 1065, end: 1110, sessionId: "ses-1", workspaceId: "ws-1", why: "after football" }],
          [{ kind: "session", title: "Thermodynamics — entropy", start: 900, end: 950, sessionId: "ses-1", workspaceId: "ws-1" }],
          [{ kind: "session", title: "Energetics recap", start: 900, end: 940, sessionId: "ses-1", workspaceId: "ws-1", why: "before the dentist" }],
          [{ kind: "review", title: "Flashcards · 12 due", start: 960, end: 975 }, { kind: "session", title: "Mock paper, section A", start: 990, end: 1050, sessionId: "ses-1", workspaceId: "ws-1", why: "exam in 3 weeks" }],
        ];
        return (list[i] ?? []).map((b, j) => ({ id: `${date}-${j}`, ...b }));
      };
      const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setUTCDate(monday.getUTCDate() + i); return ymd(d); })
        .map((date, i) => ({ date, busy: busyFor(i), slots: blocksFor(date, i) }));
      return { plan: { dailyGoalMin: 45, examTitle: "Bio Paper 1", examDate: new Date(Date.now() + 23 * 86400000), windowStart: "15:00", windowEnd: "19:00", weekdays: [1, 2, 3, 4, 5, 6, 0], timezone: "UTC" }, weekStart: ymd(monday), days, plannedMinutes: days.reduce((n, d) => n + d.slots.reduce((m, s) => m + s.end - s.start, 0), 0), unscheduled: 0, lessonsLeft: 5, lessonsTotal: 14, dueCards: 12, nudge: { date: days[6].date, minutes: 10 }, summary: "Energetics gets the early part of the week while it has the most left; Wednesday moves to after football and Friday finishes before the dentist. Sunday is a rest day.", source: "ai", calendar: { connected: true, email: "demo@scribe.study", error: null } };
    }
    case "flashcards.getDueReview":
      return { total: 0, cards: [] };
    case "podcast.listEpisodes":
      return [];
    case "podcast.getAvailableVoices":
      return [];
    case "podcast.getCharacters":
      return [];
    case "flashcards.getMasteryMatrix":
      return [
        {
          topic: "Thermochemistry",
          proficiency: 42,
          cardsStudied: 8,
          cardsTotal: 20,
          attempts: 8,
        },
        {
          topic: "Hess's law",
          proficiency: 18,
          cardsStudied: 2,
          cardsTotal: 12,
          attempts: 3,
        },
        {
          topic: "Bond enthalpies",
          proficiency: 0,
          cardsStudied: 0,
          cardsTotal: 10,
          attempts: 0,
        },
      ];
    case "studySession.activityCalendar":
      return [];
    case "workspace.marketplaceArtifacts":
      return [];
    case "payment.getPlans":
      return [];
    case "payment.getTokenBalance":
      return { balance: 120 };
    case "stats.public":
      // Landing page stats strip (set STATS_FAIL=1 to test the fallback path)
      if (process.env.STATS_FAIL) throw new Error("stats unavailable");
      if (process.env.STATS_NULL) return null;
      return { artifacts: 2345, activities: 512, countries: 23, minutes: 8900 };
    default:
      return null; // generic fallback
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  if (url.pathname.startsWith("/upload/") && req.method === "PUT") {
    req.on("data", () => {});
    req.on("end", () => {
      res.writeHead(200);
      res.end("ok");
    });
    return;
  }

  if (url.pathname === "/copilot/stream" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      res.writeHead(200, { "content-type": "text/event-stream" });
      const answer =
        "Got it — IB Chemistry HL, focusing on energetics. Press Start study session when you are ready, or tell me which topic to weight first: Hess's law, bond enthalpies, or entropy.";
      const words = answer.split(" ");
      let i = 0;
      const tick = setInterval(() => {
        if (i < words.length) {
          res.write(
            `data: ${JSON.stringify({ type: "delta", text: words[i] + " " })}\n\n`,
          );
          i++;
        } else {
          clearInterval(tick);
          res.write(
            `data: ${JSON.stringify({
              type: "final",
              answer,
              widgets: [],
              visualizations: [],
              highlights: [],
            })}\n\n`,
          );
          res.end();
        }
      }, 30);
    });
    return;
  }

  if (url.pathname.startsWith("/trpc/")) {
    const procs = url.pathname.slice(6).split(",");
    const isBatch = url.searchParams.get("batch") === "1";

    const respond = (inputs) => {
      let delay = 0;
      const results = procs.map((p, i) => {
        let data = handleProc(p, inputs[i]);
        if (data && data.__delayMs) {
          delay = Math.max(delay, data.__delayMs);
          data = data.value;
        }
        return {
          result: { data: data && data.__superjson ? data.__superjson : sj(data) },
        };
      });
      setTimeout(() => {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(isBatch ? results : results[0]));
      }, delay);
    };

    if (req.method === "GET") {
      let inputs = [];
      const raw = url.searchParams.get("input");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (isBatch) {
          inputs = procs.map((_, i) => parsed[String(i)] && parsed[String(i)].json);
        } else {
          inputs = [parsed.json];
        }
      }
      respond(inputs);
    } else {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        let inputs = [];
        try {
          const parsed = JSON.parse(body || "{}");
          if (isBatch) {
            inputs = procs.map((_, i) => parsed[String(i)] && parsed[String(i)].json);
          } else {
            inputs = [parsed.json];
          }
        } catch {}
        respond(inputs);
      });
    }
    return;
  }

  res.writeHead(404);
  res.end("not found");
});

server.listen(4600, () => console.log("mock trpc on 4600"));
