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
];

let wsCounter = 10;

function handleProc(path, input) {
  switch (path) {
    case "auth.getSession":
      return { user };
    case "workspace.getTree":
      return { folders: [], workspaces };
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
    case "studySession.list":
      return [];
    case "studySession.listBank":
      return [];
    case "flashcards.getMasteryMatrix":
      return [];
    case "studySession.activityCalendar":
      return [];
    case "payment.getPlans":
      return [];
    case "payment.getTokenBalance":
      return { balance: 120 };
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
        return { result: { data: sj(data) } };
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
