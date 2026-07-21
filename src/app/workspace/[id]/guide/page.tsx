"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { fetchWorkspace } from "@/lib/api/workspace";
import { fetchStudyGuide } from "@/lib/api/podcast";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { MarkdownText } from "@/components/ui/markdown-text";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen } from "lucide-react";

interface EditorJsBlock {
  id?: string;
  type: string;
  data: { text?: string; level?: number; items?: unknown[] };
}

function parseEditorJsBlocks(content: string): EditorJsBlock[] | null {
  try {
    const parsed = JSON.parse(content) as { blocks?: EditorJsBlock[] };
    if (parsed && Array.isArray(parsed.blocks)) return parsed.blocks;
  } catch {
    // not EditorJS JSON — treat as markdown
  }
  return null;
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, "");
}

function GuideContent({ content }: { content: string }) {
  const blocks = parseEditorJsBlocks(content);
  if (!blocks) {
    return <MarkdownText text={content} className="space-y-3" />;
  }
  return (
    <div className="space-y-3">
      {blocks.map((block, i) => {
        if (block.type === "header") {
          const level = block.data.level ?? 2;
          const text = stripHtml(block.data.text ?? "");
          if (level <= 2)
            return (
              <h2 key={block.id ?? i} className="text-lg font-semibold pt-2">
                {text}
              </h2>
            );
          return (
            <h3 key={block.id ?? i} className="text-base font-semibold pt-1">
              {text}
            </h3>
          );
        }
        if (block.type === "list" && Array.isArray(block.data.items)) {
          return (
            <ul key={block.id ?? i} className="list-disc pl-5 space-y-1">
              {block.data.items.map((item, j) => (
                <li key={j} className="text-sm leading-relaxed">
                  <MarkdownText
                    text={stripHtml(
                      typeof item === "string"
                        ? item
                        : ((item as { content?: string }).content ?? ""),
                    )}
                  />
                </li>
              ))}
            </ul>
          );
        }
        const text = stripHtml(block.data.text ?? "");
        if (!text) return null;
        return (
          <div key={block.id ?? i} className="text-sm leading-relaxed">
            <MarkdownText text={text} />
          </div>
        );
      })}
    </div>
  );
}

export default function WorkspaceGuidePage() {
  const params = useParams();
  const workspaceId = params.id as string;

  const { data: workspace, isLoading: workspaceLoading } = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => fetchWorkspace(workspaceId),
  });
  const {
    data: guide,
    isLoading: guideLoading,
    error,
  } = useQuery({
    queryKey: ["study-guide", workspaceId],
    queryFn: () => fetchStudyGuide(workspaceId),
  });

  if (workspaceLoading || guideLoading) {
    return (
      <WorkspaceShell workspace={workspace} loading>
        <div className="space-y-4">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell workspace={workspace}>
      <div className="animate-fade-up">
        {error || !guide ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
            <BookOpen className="h-8 w-8 text-faint" />
            <p className="mt-3 text-sm font-medium">No study guide yet</p>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              Upload materials in the Materials tab — Scribe builds a study
              guide from them automatically.
            </p>
          </div>
        ) : (
          <article className="rounded-2xl border border-border bg-card px-6 py-6">
            <h1 className="text-xl font-semibold">{guide.title}</h1>
            <div className="mt-4">
              <GuideContent content={guide.content ?? ""} />
            </div>
          </article>
        )}
      </div>
    </WorkspaceShell>
  );
}
