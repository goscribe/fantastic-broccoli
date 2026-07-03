import { api } from "./trpc-client";
import { isLiveApi } from "./config";

/**
 * Data layer for the copilot chat, backed by the server's `copilot` tRPC
 * router (conversations persisted per workspace). Demo mode falls back to
 * the scripted responses in copilot-script.ts.
 */

export interface CopilotConversation {
  id: string;
  title: string;
}

export async function listConversations(
  workspaceId: string,
): Promise<CopilotConversation[]> {
  if (!isLiveApi) return [];
  const rows = await api.copilot.listConversations.query({ workspaceId });
  return rows.map((r) => ({ id: r.id, title: r.title }));
}

export async function createConversation(
  workspaceId: string,
  title?: string,
): Promise<CopilotConversation> {
  if (!isLiveApi) {
    return { id: `local-${Date.now()}`, title: title ?? "New chat" };
  }
  const row = await api.copilot.createConversation.mutate({
    workspaceId,
    title,
  });
  return { id: row.id, title: row.title };
}

export async function askCopilot(input: {
  workspaceId: string;
  conversationId?: string;
  message: string;
  documentContent?: string;
}): Promise<string> {
  const result = await api.copilot.ask.mutate({
    context: {
      workspaceId: input.workspaceId,
      artifactId: input.workspaceId,
      artifactType: "study-guide",
      documentContent: input.documentContent ?? "",
    },
    message: input.message,
    conversationId: input.conversationId,
  });
  return result.answer;
}

export { isLiveApi as isLiveCopilot };
