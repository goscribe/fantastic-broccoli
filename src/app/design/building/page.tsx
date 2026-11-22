import { BuildStage } from "@/components/session/build-stage";
import { WarmupCard } from "@/components/design/generating";

const PLAN = [
  { title: "Read: how a model learns from labelled data", type: "READING" },
  { title: "Check: supervised or unsupervised?", type: "COMPREHENSION_CHECK" },
  { title: "Flashcards: key terms", type: "FLASHCARD_REVIEW" },
  { title: "Practice: choosing an evaluation measure", type: "MCQ" },
  { title: "Worksheet: overfitting and fixes", type: "WORKSHEET" },
];

/** Session build screen: /design/building?step=0..4 (0 gathering, 1 outlining, 2–3 writing, 4 finishing). */
export default async function BuildingPreview({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  const { step = "2" } = await searchParams;
  const s = Math.max(0, Math.min(4, Number(step) || 0));
  const stageIndex = s <= 1 ? s : s === 4 ? 4 : 2;
  const finished = s === 2 ? PLAN.slice(0, 2).map((a) => a.title) : s >= 3 ? PLAN.slice(0, 4).map((a) => a.title) : [];
  const labels = ["Reading your 3 files: 1 of 3", "Outlining the session", "Writing activity 3 of 5 — Flashcards: key terms", "Writing activity 5 of 5 — Worksheet: overfitting and fixes", "Finishing up"];
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('new-ui')" }} />
      <div className="mx-auto flex w-full max-w-[640px] flex-col items-center gap-5 px-4 pb-12 pt-8">
        <BuildStage
          title="A4.3 Machine learning approaches"
          pct={[0.12, 0.33, 0.52, 0.74, 0.96][s]}
          label={labels[s]}
          stageIndex={stageIndex}
          stageCount={5}
          planned={s === 0 ? [] : PLAN}
          finished={finished}
          writing={s >= 2}
          hint="A study plan grounded in your materials — usually under a minute. You can leave and come back."
        />
        <div className="w-full rounded-[var(--r-panel,24px)] border border-border bg-card p-5 sm:p-7">
          <WarmupCard hero />
        </div>
      </div>
    </>
  );
}
