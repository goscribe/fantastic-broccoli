/**
 * What the Quick 5 debrief's main button says and starts. Pure, so the rules
 * can be tested without React.
 */

/**
 * The server's refusal for a session in a subject with no course and nothing
 * uploaded (goscribe/server NO_MATERIALS_MESSAGE). A course subject never
 * gets it: its sessions are planned from the course's next topics.
 */
const NO_MATERIALS_START = "This workspace has no analyzed materials yet.";

export function isNoMaterialsError(err: unknown): boolean {
  return err instanceof Error && err.message.startsWith(NO_MATERIALS_START);
}

/**
 * The hand-off button after a Quick 5: finish the full session already made,
 * else start one — on the course's next topic when the subject follows a
 * course ("Next: 1.2 Competitive markets (~15 min)"), so the label says what
 * opens, else "Start today's session (~15 min)".
 */
export function handOffCta(input: {
  hasFullSession: boolean;
  nextTitle: string | null | undefined;
}): { key: "session.quick5FinishCta" | "session.quick5NextCta" | "session.quick5StartCta"; topic?: string } {
  if (input.hasFullSession) return { key: "session.quick5FinishCta" };
  const topic = input.nextTitle?.trim();
  return topic ? { key: "session.quick5NextCta", topic } : { key: "session.quick5StartCta" };
}
