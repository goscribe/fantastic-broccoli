import { GraphData, CitationData } from "@/components/ai/embeds";
import { WidgetId } from "@/components/interactive";

/** Server copilot tool names; unknown names still render with a generic icon. */
export type ToolName =
  | "attach_study_aids"
  | "search_workspace_knowledge"
  | "search_study_session"
  | "search_all_study_sessions"
  | "modify_study_session"
  | "manage_workspace"
  | "create_study_session"
  | "attach_study_session"
  | "attach_artifact"
  | "record_mastery"
  | "import_youtube_video";

export interface ToolCallPart {
  kind: "tool";
  id: string;
  tool: ToolName | (string & {});
  label: string;
  args: string;
  result: string;
  status: "running" | "done";
}

export interface TextPart {
  kind: "text";
  id: string;
  text: string;
  done: boolean;
}

export type EmbedSpec =
  | { embed: "equation"; latex: string; caption?: string }
  | { embed: "graph"; graph: GraphData }
  | { embed: "widget"; widget: WidgetId; intro?: string; outro?: string }
  | { embed: "html"; html: string; title?: string }
  | { embed: "citation"; citation: CitationData };

export type EmbedPart = { kind: "embed"; id: string } & EmbedSpec;

export type MessagePart = ToolCallPart | TextPart | EmbedPart;

export interface ChatMessage {
  id: string;
  chatId?: string;
  role: "user" | "assistant";
  parts: MessagePart[];
}

export const suggestions = [
  "Quiz me on this session's weakest topic",
  "Explain the current activity in simpler terms",
  "Show me an interactive simulation for this topic",
  "Where do my uploaded materials cover this?",
];
