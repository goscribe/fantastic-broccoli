"use client";

import { useState } from "react";
import { RichAnswerField } from "@/components/ui/rich-answer-field";
import { MarkdownText } from "@/components/ui/markdown-text";
import { playField } from "@/components/session/play-ui";
import { shrinkFigure } from "@/lib/api/answer-figures";

/**
 * Design preview of the answer box's Table and Figure tools. Pictures are
 * shrunk as in the app but kept in the page (a data URL) instead of going to
 * the server. Under the box: the saved Markdown, and how review pages show it.
 * /design is a dev-only route.
 */
async function keepInPage(picture: Blob, opts: { keepPng?: boolean }): Promise<string> {
  const small = await shrinkFigure(picture, opts);
  return await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(small);
  });
}

export default function AnswerFiguresPreview() {
  const [value, setValue] = useState("A ball is dropped from rest. Readings every half second:");
  return (
    <div className="mx-auto w-full max-w-[720px] px-4 pb-24 pt-6 sm:px-6">
      <p className="text-small font-semibold text-muted-foreground">Question 2 · 4 marks</p>
      <h1 className="mt-1 text-[20px] font-semibold leading-[1.35]">Record the ball&apos;s speed over time in a table, and sketch its velocity–time graph.</h1>
      <div className="mt-4" data-testid="answer">
        <RichAnswerField value={value} onChange={setValue} rows={4} placeholder="Write your answer…" uploadFigure={keepInPage} className={playField} />
      </div>
      <details className="mt-8" open>
        <summary className="cursor-pointer text-small font-extrabold text-muted-foreground">How it is saved and shown</summary>
        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl bg-muted p-3 text-[12px] leading-snug" data-testid="saved">
          {value.replace(/data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+/g, "data:…")}
        </pre>
        <div className="mt-3 rounded-2xl border border-border p-4 text-read" data-testid="review">
          <MarkdownText text={value} />
        </div>
      </details>
    </div>
  );
}
