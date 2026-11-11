import type { CopilotMsg } from "@/components/design/copilot-panel";
import { OsmosisFigure } from "@/components/design/figure";
import { AnswerBox, BottomBar, Checklist, DrawToolbar, FeedbackCard, Markscheme, Option, QuestionFrame, ScoreCard, Sketch, btnOutline, btnPrimary } from "@/components/design/question";
import { ClozeBody, ExplainBody, MatchingBody, NumericBody, SummaryBody, TrueFalseBody } from "@/components/design/question-types";

export type QType = "mcq" | "text" | "sketch" | "numeric" | "truefalse" | "matching" | "cloze" | "summary" | "explain";

const MSGS: CopilotMsg[] = [
  { who: "u", text: "Why does water leave if NaCl can't cross the membrane?" },
  { who: "a", text: <>Good question — that&apos;s exactly the point. The membrane is <b>selectively permeable</b>: water passes through aquaporins, Na⁺ and Cl⁻ mostly don&apos;t.<br /><br />So the only thing that <i>can</i> move to balance the concentrations is water, and it moves toward the side with more solute (the 0.3 M outside). Net result: the cell loses water and shrinks.</> },
];

const SIDE = "w-[320px] shrink-0";
const Hint = ({ title, children }: { title: string; children: React.ReactNode }) => <div className="rounded-2xl bg-muted p-4"><div className="text-[11px] font-semibold text-faint">{title}</div><div className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{children}</div></div>;

export default async function QuestionPreview({ searchParams }: { searchParams: Promise<{ type?: QType; state?: "q" | "fb"; chat?: string; panel?: string; tip?: string }> }) {
  const { type = "mcq", state = "q", chat, panel, tip } = await searchParams;
  const fb = state === "fb";
  const panelOpen = panel !== "closed";
  const messages = chat ? MSGS : undefined;
  const actions = (primary: string) => <BottomBar left={<button className={btnOutline}>Skip</button>} right={<button className={btnPrimary}>{primary}</button>} />;
  const frame = (p: { tag: string; qi: number; qn: number; question: string; bottom: React.ReactNode; children: React.ReactNode }) => <QuestionFrame {...p} messages={messages} panelOpen={panelOpen} />;

  switch (type) {
    case "text":
      return frame({ tag: "Worksheet · Osmosis · Text · 6 marks", qi: 5, qn: 7, question: "Explain, using water potential, why a red blood cell shrinks in 0.3 M NaCl. [6]",
        bottom: fb ? <FeedbackCard ok title="4 of 6 marks" message="M5 and M6 missing: name the solution (hypertonic) and quote Ψ = Ψs + Ψp. Hover a highlight to see which point it earned." secondary="Improve answer" primary="Continue" /> : actions("Mark my answer"),
        children: <div className="flex items-start gap-5"><div className="min-w-0 flex-1"><AnswerBox marked={fb} showTip={tip === "1"} /></div><div className={SIDE}>{fb ? <div className="flex flex-col gap-3"><ScoreCard num={4} den={6} title="Good answer" sub="2 marks missing · see below" /><Markscheme /></div> : <Hint title="Markscheme · 6 marks">Hidden until you check. Cover: definition, units, direction of movement, effect on the cell, correct term for the solution.<div className="mt-3 flex flex-wrap gap-1.5">{["Define", "Direction", "Effect", "Term"].map((c) => <span key={c} className="rounded-[7px] border border-border bg-white px-2 py-1 text-[12px] font-semibold text-muted-foreground">{c}</span>)}</div></Hint>}</div></div> });
    case "sketch":
      return frame({ tag: "Worksheet · Osmosis · Sketch", qi: 6, qn: 7, question: "Sketch a red blood cell before and after it is placed in 0.3 M NaCl. Show the direction of water movement.",
        bottom: fb ? <FeedbackCard ok title="3 of 4 features" message="Your shrunken cell and arrows match; add an H₂O label to the arrows." secondary="Keep drawing" primary="Continue" /> : actions("Submit drawing"),
        children: <div className="flex items-start gap-5"><div className="min-w-0 flex-1"><Sketch overlay={fb} /><DrawToolbar /></div><div className="w-[300px] shrink-0">{fb ? <div className="flex flex-col gap-3"><ScoreCard num={3} den={4} title="Nearly there" sub="Compared with the model answer" /><Checklist items={[["Cell smaller after", true], ["Water arrows point outwards", true], ["Membrane intact", true], ["Label the direction of H₂O", false]]} /></div> : <Hint title="What we check"><ol className="flex flex-col gap-1.5">{["Cell drawn smaller after", "Arrows show water leaving", "Membrane stays intact (animal cell)", "Labels: H₂O direction"].map((c, i) => <li key={c} className="flex gap-2"><span className="font-bold text-accent">{i + 1}</span>{c}</li>)}</ol><p className="mt-3 text-[12px] text-faint">Draw with mouse, finger or stylus. Photo of paper also works.</p></Hint>}</div></div> });
    case "numeric":
      return frame({ tag: "Worksheet · Osmosis · Numeric · 2 marks", qi: 2, qn: 7, question: "A potato cylinder's mass changes from 2.40 g to 2.13 g in 0.5 M sucrose. Calculate the percentage change in mass. [2]",
        bottom: fb ? <FeedbackCard ok title="Correct · 2 of 2" message="−11.3% (accepted −11.2 to −11.4). Working shown earns M1 even if the final answer slips." secondary="See working" primary="Continue" /> : actions("Check answer"),
        children: <NumericBody marked={fb} /> });
    case "truefalse":
      return frame({ tag: "Quick 5 · 3.2 Transport · True / false", qi: 1, qn: 5, question: "Facilitated diffusion requires ATP.",
        bottom: fb ? <FeedbackCard ok={false} title="Not quite" message="Facilitated diffusion is passive — it uses channel or carrier proteins but no ATP. Active transport is the one that needs energy." secondary="Explain with Copilot" primary="Got it" /> : actions("Check answer"),
        children: <TrueFalseBody marked={fb} /> });
    case "matching":
      return frame({ tag: "Worksheet · Osmosis · Matching · 4 marks", qi: 3, qn: 7, question: "Match each solution to what happens to an animal cell placed in it.",
        bottom: fb ? <FeedbackCard ok title="3 of 4 matched" message="Isotonic ↔ no net change was swapped with hypotonic. Everything else is right." secondary="Fix the mismatch" primary="Continue" /> : actions("Check matches"),
        children: <MatchingBody marked={fb} /> });
    case "cloze":
      return frame({ tag: "Cloze · 3.2 Transport · Fill in the blank", qi: 2, qn: 6, question: "Complete the passage from your notes.",
        bottom: fb ? <FeedbackCard ok title="5 of 6 blanks" message="“permeable” was “selectively permeable” in your notes — the qualifier is the mark." secondary="Review blanks" primary="Continue" /> : actions("Check blanks"),
        children: <ClozeBody marked={fb} /> });
    case "summary":
      return frame({ tag: "Comprehension check · 3.2 Transport · Summary", qi: 7, qn: 9, question: "In 2–3 sentences, summarise how substances cross a membrane and what decides which route they take.",
        bottom: fb ? <FeedbackCard ok title="Covers 3 of 4 ideas" message="You named the routes and the role of size/polarity; add the energy distinction (passive vs active)." secondary="Add a sentence" primary="Continue" /> : actions("Check summary"),
        children: <SummaryBody marked={fb} /> });
    case "explain":
      return frame({ tag: "Explain aloud · 3.2 Transport", qi: 8, qn: 9, question: "Explain to a Year 9 student why a red blood cell bursts in pure water. Speak for about 45 seconds.",
        bottom: fb ? <FeedbackCard ok title="Clear explanation" message="You used an analogy and the key term osmosis. One slip: you said water moves to the lower concentration of water — it's the higher." secondary="Hear it back" primary="Continue" /> : <BottomBar left={<button className={btnOutline}>Skip</button>} right={<button className={btnPrimary}>Stop &amp; check</button>} />,
        children: <ExplainBody marked={fb} /> });
    default: {
      const opts = ["Water moves out of the cell; it shrinks", "Water moves into the cell; it swells", "No net movement of water", "NaCl moves into the cell"];
      return frame({ tag: "Worksheet · Osmosis · Multiple choice", qi: 4, qn: 7, question: "A red blood cell (cytoplasm ≈ 0.15 M) is placed in a 0.3 M NaCl solution. What happens?",
        bottom: fb ? <FeedbackCard ok={false} title="Not quite" message="0.3 M is hypertonic to the cytoplasm, so water leaves the cell and it shrinks." secondary="Explain with Copilot" primary="Got it" /> : actions("Check answer"),
        children: <div className="flex items-start gap-5"><div className="flex flex-1 flex-col gap-[9px]">{opts.map((o, i) => <Option key={o} n={i + 1} state={fb ? (i === 0 ? "ok" : i === 1 ? "bad" : undefined) : i === 1 ? "sel" : undefined}>{o}</Option>)}<div className="mt-1 text-[12px] text-faint">Press 1–4 to pick · Enter to check</div></div><div className="w-[340px] shrink-0"><OsmosisFigure /></div></div> });
    }
  }
}
