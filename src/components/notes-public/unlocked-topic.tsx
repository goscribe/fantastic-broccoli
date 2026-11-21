"use client";

import { Unlock } from "lucide-react";
import type { PublicTopic } from "@/lib/api/public-notes";
import { NoteBody } from "@/components/notes/note-body";
import { InlineMarkdown } from "@/components/ui/markdown-text";
import { PracticeCard, PracticeProvider, PracticeScore } from "./practice";

/**
 * A locked topic for someone entitled to it (plan, exam pass, reviewer),
 * rendered in the browser from `topicNote.page`: the whole note and every
 * practice question. Replaces the server-rendered preview in LockedTopicGate.
 */
export function UnlockedTopic({ data, signupHref }: { data: PublicTopic; signupHref: string }) {
  const { course, topic, note, questions } = data;
  return (
    <div>
      <p className="mt-8 inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-[13px] font-extrabold text-accent-dim lg:mt-0">
        <Unlock className="size-3.5" strokeWidth={2.75} aria-hidden="true" />
        Unlocked with your plan
      </p>
      {note && (
        <div className="mt-5">
          <NoteBody note={note.content} />
        </div>
      )}
      {questions.length > 0 && (
        <PracticeProvider courseId={course.id} topicId={topic.id} questionIds={questions.map((q) => q.id)} signupHref={signupHref} trackView={false}>
          <section id="practice" className="mt-16 scroll-mt-4" aria-labelledby="h-practice-full">
            <h2 id="h-practice-full" className="text-[30px] font-black leading-[1.05] text-foreground sm:text-[38px]">
              Practice this topic
            </h2>
            <p className="mt-2.5 text-[16px] font-semibold leading-snug text-foreground/75 sm:text-[17px]">
              {questions.length} quick-fire multiple-choice questions, easy to hard. Tap an answer to see if you&apos;re right and the worked explanation.
            </p>
            <div className="mt-4">
              <PracticeScore inlineCount={0} />
            </div>
            <div className="mt-4 flex flex-col">
              {questions.map((q, i) => (
                <PracticeCard
                  key={q.id}
                  id={q.id}
                  number={i + 1}
                  difficulty={q.difficulty}
                  commandTerm={q.commandTerm}
                  marks={q.marks}
                  correctIndex={q.correctIndex}
                  placement="practice"
                  stem={<InlineMarkdown text={q.stem} />}
                  options={q.options.map((o, j) => (
                    <InlineMarkdown key={j} text={o} />
                  ))}
                  explanation={<InlineMarkdown text={q.explanation} />}
                />
              ))}
            </div>
          </section>
        </PracticeProvider>
      )}
    </div>
  );
}
