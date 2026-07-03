"use client";

import { useState } from "react";
import { ComprehensionContent } from "@/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { cn } from "@/lib/utils";
import { Brain, Send, CheckCircle2, RotateCcw } from "lucide-react";

interface ComprehensionActivityProps {
  content: ComprehensionContent;
  onSubmitRewrite: (text: string) => void;
  onComplete: () => void;
}

export function ComprehensionActivity({
  content,
  onSubmitRewrite,
  onComplete,
}: ComprehensionActivityProps) {
  const [userText, setUserText] = useState("");
  const [showOriginal, setShowOriginal] = useState(true);
  const latestEval = content.evaluations[content.evaluations.length - 1];
  const hasPassed = latestEval?.passed || !!content.passedAt;
  const attemptNumber = content.evaluations.length + 1;

  return (
    <div className="space-y-4">
      {/* Reading phase */}
      {showOriginal && (
        <Card className="border-accent/20 bg-accent/5">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="h-4 w-4 text-accent" />
            <span className="text-sm font-medium text-accent">
              Read carefully, then rewrite in your own words
            </span>
          </div>
          <div className="prose prose-sm max-w-none">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {content.originalText}
            </p>
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowOriginal(false)}
            >
              I&apos;ve read it — let me rewrite
            </Button>
          </div>
        </Card>
      )}

      {/* Rewrite phase */}
      {!showOriginal && !hasPassed && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              Attempt {attemptNumber}: Write it back in your own words
            </span>
            <button
              type="button"
              onClick={() => setShowOriginal(true)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" />
              Re-read original
            </button>
          </div>

          <textarea
            value={userText}
            onChange={(e) => setUserText(e.target.value)}
            placeholder="Explain the concept in your own words..."
            className="w-full h-32 rounded-lg border border-border bg-card p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
          />

          <div className="flex justify-end">
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                onSubmitRewrite(userText);
                setUserText("");
              }}
              disabled={userText.trim().length < 20}
            >
              <Send className="h-3.5 w-3.5 mr-1.5" />
              Submit
            </Button>
          </div>
        </div>
      )}

      {/* Previous evaluations */}
      {content.evaluations.length > 0 && (
        <div className="space-y-2">
          {content.evaluations.map((evaluation, i) => (
            <Card
              key={i}
              className={cn(
                "text-sm",
                evaluation.passed
                  ? "border-success/20 bg-success/5"
                  : "border-warning/20 bg-warning/5",
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-xs">
                  Attempt {evaluation.attempt}
                </span>
                <ProgressBar
                  value={evaluation.score}
                  className="w-24"
                  size="sm"
                  showLabel
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {evaluation.feedback}
              </p>
            </Card>
          ))}
        </div>
      )}

      {/* User's previous rewrites */}
      {content.userRewrites.length > 0 && !hasPassed && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground">
            Your previous {content.userRewrites.length === 1 ? "attempt" : "attempts"}
          </summary>
          <div className="mt-2 space-y-2">
            {content.userRewrites.map((rewrite, i) => (
              <p key={i} className="p-2 rounded-lg border border-border bg-muted/50 italic">
                &ldquo;{rewrite}&rdquo;
              </p>
            ))}
          </div>
        </details>
      )}

      {/* Passed state */}
      {hasPassed && (
        <Card className="border-success/20 bg-success/5 text-center">
          <CheckCircle2 className="h-8 w-8 text-success mx-auto mb-2" />
          <p className="text-sm font-medium">Comprehension confirmed</p>
          <p className="text-xs text-muted-foreground mt-1">
            You demonstrated understanding in {content.evaluations.length}{" "}
            {content.evaluations.length === 1 ? "attempt" : "attempts"}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={onComplete}
            className="mt-3"
          >
            Continue to next activity
          </Button>
        </Card>
      )}
    </div>
  );
}
