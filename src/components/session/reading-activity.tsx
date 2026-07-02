"use client";

import { ReadingContent } from "@/types";
import { Button } from "@/components/ui/button";
import { BookOpen, ArrowRight } from "lucide-react";

interface ReadingActivityProps {
  content: ReadingContent;
  onComplete: () => void;
}

export function ReadingActivity({ content, onComplete }: ReadingActivityProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <BookOpen className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wider">
          Reading Material
        </span>
      </div>

      <div className="prose prose-sm max-w-none">
        <div className="text-sm leading-relaxed whitespace-pre-wrap">
          {content.text}
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button variant="primary" size="sm" onClick={onComplete}>
          Done reading <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </div>
    </div>
  );
}
