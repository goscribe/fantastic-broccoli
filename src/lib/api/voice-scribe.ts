import { rpc } from "./study-session";
import type { ScribeReply, VoiceTarget } from "@/lib/voice-scribe";

/**
 * One spoken phrase → what to write, by the server's `voiceScribe` router
 * (newer than the published @goscribe/server types, hence rpc).
 */
export function interpretSpeech(input: {
  transcript: string;
  target: VoiceTarget;
  question?: string;
  written?: string;
}): Promise<ScribeReply> {
  return rpc<ScribeReply>("voiceScribe.interpret", "mutation", input);
}
