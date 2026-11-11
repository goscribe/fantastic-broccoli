import type { CopilotMsg } from "@/components/design/copilot-panel";
import { OsmosisFigure } from "@/components/design/figure";
import { AnswerBox, BottomBar, Checklist, DrawToolbar, FeedbackBar, Markscheme, Option, QuestionFrame, ScoreCard, Sketch, btnOutline, btnPrimary, type QType } from "@/components/design/question";

const MSGS: CopilotMsg[] = [
  { who: "u", text: "Why does water leave if NaCl can't cross the membrane?" },
  { who: "a", text: <>Good question — that&apos;s exactly the point. The membrane is <b>selectively permeable</b>: water passes through aquaporins, Na⁺ and Cl⁻ mostly don&apos;t.<br /><br />So the only thing that <i>can</i> move to balance the concentrations is water, and it moves toward the side with more solute (the 0.3 M outside). Net result: the cell loses water and shrinks.</> },
];

export default async function QuestionPreview({ searchParams }: { searchParams: Promise<{ type?: QType; state?: "q" | "fb"; chat?: string; panel?: string }> }) {
  const { type = "mcq", state = "q", chat, panel } = await searchParams;
  const fb = state === "fb";
  const panelOpen = panel !== "closed";
  const messages = chat ? MSGS : undefined;

  if (type === "text") {
    return (
      <QuestionFrame tag="Worksheet · Osmosis · Text · 6 marks" attached="Q5 · Worksheet · Osmosis" qi={5} qn={7} question="Explain, using water potential, why a red blood cell shrinks in 0.3 M NaCl. [6]" messages={messages} panelOpen={panelOpen}
        bottom={fb ? <FeedbackBar ok title="4 of 6 marks" message="M5 and M6 missing: name the solution (hypertonic) and quote Ψ = Ψs + Ψp." secondary="Improve answer" primary="Continue" /> : <BottomBar left={<button className={btnOutline}>Skip</button>} right={<button className={btnPrimary}>Mark my answer</button>} />}>
        <div className="flex items-start gap-5">
          <div className="min-w-0 flex-1"><AnswerBox marked={fb} /></div>
          <div className="w-[330px] shrink-0">{fb ? <div className="flex flex-col gap-3"><ScoreCard num={4} den={6} title="Good answer" sub="2 marks missing · see below" /><Markscheme /></div> : (
            <div className="rounded-2xl bg-muted p-4"><div className="text-[11px] font-semibold text-faint">Markscheme · 6 marks</div><p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">Hidden until you check. Cover: definition, units, direction of movement, effect on the cell, correct term for the solution.</p><div className="mt-3 flex flex-wrap gap-1.5">{["Define", "Direction", "Effect", "Term"].map((c) => <span key={c} className="rounded-[7px] border border-border bg-white px-2 py-1 text-[12px] font-semibold text-muted-foreground">{c}</span>)}</div></div>
          )}</div>
        </div>
      </QuestionFrame>
    );
  }

  if (type === "sketch") {
    return (
      <QuestionFrame tag="Worksheet · Osmosis · Sketch" attached="Q6 · Worksheet · Osmosis" qi={6} qn={7} question="Sketch a red blood cell before and after it is placed in 0.3 M NaCl. Show the direction of water movement." messages={messages} panelOpen={panelOpen}
        bottom={fb ? <FeedbackBar ok title="3 of 4 features" message="Your shrunken cell and arrows match; add an H₂O label to the arrows." secondary="Keep drawing" primary="Continue" /> : <BottomBar left={<button className={btnOutline}>Skip</button>} right={<button className={btnPrimary}>Submit drawing</button>} />}>
        <div className="flex items-start gap-5">
          <div className="min-w-0 flex-1"><Sketch overlay={fb} /><DrawToolbar /></div>
          <div className="w-[300px] shrink-0">{fb ? <div className="flex flex-col gap-3"><ScoreCard num={3} den={4} title="Nearly there" sub="Compared with the model answer" /><Checklist items={[["Cell smaller after", true], ["Water arrows point outwards", true], ["Membrane intact", true], ["Label the direction of H₂O", false]]} /></div> : (
            <div className="rounded-2xl bg-muted p-4"><div className="text-[11px] font-semibold text-faint">What we check</div><ol className="mt-2 flex flex-col gap-1.5 text-[13px] text-muted-foreground">{["Cell drawn smaller after", "Arrows show water leaving", "Membrane stays intact (animal cell)", "Labels: H₂O direction"].map((c, i) => <li key={c} className="flex gap-2"><span className="font-bold text-accent">{i + 1}</span>{c}</li>)}</ol><p className="mt-3 text-[12px] text-faint">Draw with mouse, finger or stylus. Photo of paper also works.</p></div>
          )}</div>
        </div>
      </QuestionFrame>
    );
  }

  const opts = ["Water moves out of the cell; it shrinks", "Water moves into the cell; it swells", "No net movement of water", "NaCl moves into the cell"];
  return (
    <QuestionFrame tag="Worksheet · Osmosis · Multiple choice" attached="Q4 · Worksheet · Osmosis" qi={4} qn={7} question="A red blood cell (cytoplasm ≈ 0.15 M) is placed in a 0.3 M NaCl solution. What happens?" messages={messages} panelOpen={panelOpen}
      bottom={fb ? <FeedbackBar ok={false} title="Not quite" message="0.3 M is hypertonic to the cytoplasm, so water leaves the cell and it shrinks." secondary="Explain with Copilot" primary="Got it" /> : <BottomBar left={<button className={btnOutline}>Skip</button>} right={<button className={btnPrimary}>Check answer</button>} />}>
      <div className="flex items-start gap-5">
        <div className="flex flex-1 flex-col gap-[9px]">
          {opts.map((o, i) => <Option key={o} n={i + 1} state={fb ? (i === 0 ? "ok" : i === 1 ? "bad" : undefined) : i === 1 ? "sel" : undefined}>{o}</Option>)}
          <div className="mt-1 text-[12px] text-faint">Press 1–4 to pick · Enter to check</div>
        </div>
        <div className="w-[340px] shrink-0"><OsmosisFigure /></div>
      </div>
    </QuestionFrame>
  );
}
