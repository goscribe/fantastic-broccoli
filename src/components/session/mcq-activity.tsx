"use client";

import { useState } from "react";
import { McqContent } from "@/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, ArrowRight } from "lucide-react";

interface McqActivityProps {
  content: McqContent;
  onAnswer: (selectedIndex: number) => void;
  onComplete: () => void;
}

export function McqActivity({
  content,
  onAnswer,
  onComplete,
}: McqActivityProps) {
  const [selected, setSelected] = useState<number | null>(
    content.userAnswer ?? null,
  );
  const [revealed, setRevealed] = useState(content.userAnswer !== undefined);

  const handleSubmit = () => {
    if (selected === null) return;
    onAnswer(selected);
    setRevealed(true);
  };

  const isCorrect = selected === content.correctIndex;

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium leading-relaxed">{content.question}</p>

      <div className="space-y-2">
        {content.options.map((option, i) => (
          <button
            key={i}
            type="button"
            onClick={() => !revealed && setSelected(i)}
            disabled={revealed}
            className={cn(
              "w-full text-left p-3 rounded-lg border text-sm",
              !revealed && selected === i && "border-accent bg-accent/5",
              !revealed && selected !== i && "border-border hover:border-accent/30 hover:bg-muted/30",
              revealed && i === content.correctIndex && "border-success bg-success/5",
              revealed && selected === i && i !== content.correctIndex && "border-red-500 bg-red-500/5",
              revealed && selected !== i && i !== content.correctIndex && "opacity-50",
            )}
          >
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium flex-shrink-0",
                  !revealed && selected === i && "bg-accent text-accent-foreground",
                  !revealed && selected !== i && "bg-muted text-muted-foreground",
                  revealed && i === content.correctIndex && "bg-success text-white",
                  revealed && selected === i && i !== content.correctIndex && "bg-red-500 text-white",
                )}
              >
                {String.fromCharCode(65 + i)}
              </span>
              <span className="flex-1">{option}</span>
              {revealed && i === content.correctIndex && (
                <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
              )}
              {revealed && selected === i && i !== content.correctIndex && (
                <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
              )}
            </div>
          </button>
        ))}
      </div>

      {!revealed && (
        <div className="flex justify-end">
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={selected === null}
          >
            Check answer
          </Button>
        </div>
      )}

      {revealed && (
        <Card
          className={cn(
            "text-sm",
            isCorrect
              ? "border-success/20 bg-success/5"
              : "border-red-500/20 bg-red-500/5",
          )}
        >
          <p className="font-medium text-xs mb-1">
            {isCorrect ? "Correct!" : "Not quite"}
          </p>
          <p className="text-xs text-muted-foreground">
            {content.explanation}
          </p>
          <div className="flex justify-end mt-3">
            <Button variant="ghost" size="sm" onClick={onComplete}>
              Next <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
