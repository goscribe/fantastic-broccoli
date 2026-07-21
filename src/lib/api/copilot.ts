import { api } from "./trpc-client";
import { apiUrl } from "./config";

/**
 * Data layer for the copilot chat, backed by the server's `copilot` tRPC
 * router (conversations persisted per workspace).
 */

export interface CopilotConversation {
  id: string;
  title: string;
}

export async function listConversations(
  workspaceId: string,
): Promise<CopilotConversation[]> {
  const rows = await api.copilot.listConversations.query({ workspaceId });
  return rows.map((r) => ({ id: r.id, title: r.title }));
}

export async function createConversation(
  workspaceId: string,
  title?: string,
): Promise<CopilotConversation> {
  const row = await api.copilot.createConversation.mutate({
    workspaceId,
    title,
  });
  return { id: row.id, title: row.title };
}

export interface CopilotHistoryMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export async function getConversationMessages(
  workspaceId: string,
  conversationId: string,
): Promise<CopilotHistoryMessage[]> {
  const conv = await api.copilot.getConversation.query({
    workspaceId,
    conversationId,
  });
  return conv.messages.map((m) => ({
    id: m.id,
    role: m.role === "user" ? "user" : "assistant",
    content: m.content,
  }));
}

export interface CopilotVisualization {
  title?: string;
  html: string;
}

export interface CopilotAnswer {
  answer: string;
  widgets: string[];
  visualizations: CopilotVisualization[];
}

export async function askCopilot(input: {
  workspaceId: string;
  conversationId?: string;
  message: string;
  documentContent?: string;
  availableWidgets?: { id: string; description: string }[];
}): Promise<CopilotAnswer> {
  type AskInput = Parameters<typeof api.copilot.ask.mutate>[0];
  // availableWidgets is newer than the published @goscribe/server types.
  const context = {
    workspaceId: input.workspaceId,
    artifactId: input.workspaceId,
    artifactType: "study-guide",
    documentContent: input.documentContent ?? "",
    availableWidgets: input.availableWidgets,
  } as AskInput["context"];
  const result = await api.copilot.ask.mutate({
    context,
    message: input.message,
    conversationId: input.conversationId,
  });
  return {
    answer: result.answer,
    widgets: (result as { widgets?: string[] }).widgets ?? [],
    visualizations:
      (result as { visualizations?: CopilotVisualization[] }).visualizations ??
      [],
  };
}

type StreamEvent =
  | { type: "delta"; text: string }
  | ({ type: "final" } & CopilotAnswer)
  | { type: "error"; message: string };

/**
 * Streaming variant of askCopilot backed by the server's `/copilot/stream`
 * SSE endpoint: `onDelta` fires with answer text as it generates; resolves
 * with the full structured payload. Falls back to the non-streaming
 * mutation if the endpoint is unavailable (e.g. older server deploys).
 */
export async function askCopilotStream(
  input: Parameters<typeof askCopilot>[0],
  onDelta: (text: string) => void,
): Promise<CopilotAnswer> {
  let res: Response;
  try {
    res = await fetch(`${apiUrl}/copilot/stream`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        context: {
          workspaceId: input.workspaceId,
          artifactId: input.workspaceId,
          artifactType: "study-guide",
          documentContent: input.documentContent ?? "",
          availableWidgets: input.availableWidgets,
        },
        message: input.message,
        conversationId: input.conversationId,
      }),
    });
  } catch {
    return askCopilot(input);
  }
  if (!res.ok || !res.body) {
    if (res.status === 404 || res.status === 405) return askCopilot(input);
    throw new Error(
      res.status === 401
        ? "Please sign in again to use the copilot."
        : "Copilot request failed — try again.",
    );
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let final: CopilotAnswer | null = null;

  const handleLine = (line: string) => {
    if (!line.startsWith("data: ")) return;
    let event: StreamEvent;
    try {
      event = JSON.parse(line.slice(6)) as StreamEvent;
    } catch {
      return;
    }
    if (event.type === "delta") onDelta(event.text);
    else if (event.type === "final")
      final = {
        answer: event.answer,
        widgets: event.widgets ?? [],
        visualizations: event.visualizations ?? [],
      };
    else if (event.type === "error") throw new Error(event.message);
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) handleLine(line.trim());
  }
  if (buffer.trim()) handleLine(buffer.trim());

  if (!final) throw new Error("Copilot stream ended unexpectedly — try again.");
  return final;
}
