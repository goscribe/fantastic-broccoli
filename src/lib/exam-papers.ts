/**
 * Which exam papers allow a calculator, by the paper ids the server uses for
 * the start check's paper choice (`StudySession.paperFocus`) and practice
 * papers. Mirrors the `calculator` flags of goscribe/server
 * `src/lib/exam-papers.ts` (PAPER_FORMATS); papers not listed there say
 * nothing either way. Change the two together.
 */
export const PAPER_CALCULATOR: Readonly<Record<string, boolean>> = {
  "ib-sci-p1": false,
  "ib-sci-p2": true,
  "ib-sci-p3": true,
  "ib-math-p1": false,
  "ib-math-p2": true,
  "ib-econ-p2": true,
  "ap-frq": true,
  "alevel-p1": true,
  "gcse-p1": true,
  "sat-math": true,
};

/** True / false when the paper format says so, null when it does not (or the id is unknown). */
export function paperAllowsCalculator(paperId: string | null | undefined): boolean | null {
  if (!paperId) return null;
  return paperId in PAPER_CALCULATOR ? PAPER_CALCULATOR[paperId] : null;
}
