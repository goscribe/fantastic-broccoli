// Minimal mock goscribe/server for UI screenshots.
const http = require("http");

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
    folderId: null,
    icon: "book",
    color: "green",
    updatedAt: new Date().toISOString(),
    uploads: [],
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

function handleProc(path, input) {
  switch (path) {
    case "auth.getSession":
      return { user };
    case "workspace.getTree":
      // EMPTY=1 simulates a brand-new user (triggers first-session onboarding).
      if (process.env.EMPTY === "1") return { folders: [], workspaces: [] };
      return { folders, workspaces };
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
    case "studySession.get": {
      const id = (input && input.id) || "ses-1";
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
    case "flashcards.getDueReview":
      return { total: 0, cards: [] };
    case "podcast.listEpisodes":
      return [];
    case "podcast.getAvailableVoices":
      return [];
    case "podcast.getCharacters":
      return [];
    case "flashcards.getMasteryMatrix":
      return [];
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
        "Got it — IB Chemistry HL, focusing on energetics. Which topics trip you up most: Hess's law, bond enthalpies, or entropy and spontaneity?";
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
      const results = procs.map((p, i) => {
        const data = handleProc(p, inputs[i]);
        return {
          result: { data: data && data.__superjson ? data.__superjson : sj(data) },
        };
      });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(isBatch ? results : results[0]));
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
