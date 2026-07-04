import { GraphData, CitationData } from "@/components/ai/embeds";
import { WidgetId } from "@/components/interactive";

export type ToolName =
  | "search_materials"
  | "update_plan"
  | "add_activity"
  | "generate_summary";

export interface ToolCallPart {
  kind: "tool";
  id: string;
  tool: ToolName;
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
