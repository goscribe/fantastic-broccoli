import { rpc } from "./study-session";

export type FeedbackKind = "GENERAL" | "CANCEL";

export const CANCEL_REASONS: { value: string; label: string }[] = [
  { value: "too_expensive", label: "Too expensive" },
  { value: "content_quality", label: "Generated content wasn't good enough" },
  { value: "not_enough_time", label: "Didn't have time to use it" },
  { value: "missing_feature", label: "Missing something I needed" },
  { value: "found_alternative", label: "Found something that fits better" },
  { value: "technical_problems", label: "Something kept breaking" },
  { value: "exam_over", label: "My exams are over" },
  { value: "other", label: "Other" },
];

export interface FeedbackContext {
  kind: FeedbackKind;
  name: string | null;
  email: string | null;
}

export const feedbackApi = {
  getContext: (input: { token?: string; kind?: FeedbackKind }) =>
    rpc<FeedbackContext>("feedback.getContext", "query", input),

  submit: (input: {
    token?: string;
    kind?: FeedbackKind;
    reason?: string;
    answers: Record<string, string>;
    contactOk: boolean;
  }) => rpc<{ id: string }>("feedback.submit", "mutation", input),
};
