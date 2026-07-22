"use client";

import React, { useEffect, useMemo, useState } from "react";
import katex from "katex";
import { rpc } from "@/lib/api/study-session";

// Signed-URL cache for figure object keys (keys are permanent; signed URLs
// expire, so content stores keys and we sign on render).
const signedUrlCache = new Map<string, Promise<string>>();

function signObjectKey(objectKey: string): Promise<string> {
  let promise = signedUrlCache.get(objectKey);
  if (!promise) {
    promise = rpc<{ url: string }>("workspace.getFigureUrl", "query", {
      objectKey,
    }).then((r) => r.url);
    promise.catch(() => signedUrlCache.delete(objectKey));
    signedUrlCache.set(objectKey, promise);
  }
  return promise;
}

// [Figure: <url-or-key> — <description>] tokens baked into generated content.
const FIGURE_TOKEN =
  /\[Figure:\s*(\S+?)(?:\s*[—–-]{1,2}\s*([^\]]*))?\]/g;
// Markdown images: ![alt](url)
const MD_IMAGE = /!\[([^\]]*)\]\((\S+?)\)/g;
// Bare image URLs (incl. Supabase signed URLs).
const BARE_IMAGE_URL =
  /https?:\/\/\S+?(?:\.(?:png|jpe?g|gif|webp|svg)(?:\?\S*)?|\/storage\/v1\/object\/sign\/\S+)/g;

const INLINE_RE =
  /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\))/g;

// LaTeX math: $$display$$, \[display\], $inline$, \(inline\), plus bare
// undelimited fragments like `e^{i x}`, `lim_{n→∞}` or `\frac{a}{b}` that
// generated content sometimes emits without $ delimiters.
const BARE_MATH_SRC =
  "[A-Za-z0-9()\\[\\]+\\-=/]*(?:[\\^_]\\{[^{}]*\\}|\\\\[a-zA-Z]+\\{[^{}]*\\})(?:[A-Za-z0-9^_+\\-=/()\\[\\]]|\\{[^{}]*\\}|\\\\[a-zA-Z]+)*";
const MATH_RE = new RegExp(
  `(\\$\\$[\\s\\S]+?\\$\\$|\\\\\\[[\\s\\S]+?\\\\\\]|(?<!\\\\)\\$(?:\\\\\\$|[^$\\n])+?(?<!\\\\)\\$|\\\\\\([\\s\\S]+?\\\\\\)|${BARE_MATH_SRC})`,
  "g",
);

// Escaped literal characters like \% \$ \& \# \_ in generated prose render
// as the character itself rather than showing the backslash.
function unescapeChars(text: string): string {
  return text.replace(/\\([%$&#_{}])/g, "$1");
}

function parseMathToken(token: string): { latex: string; display: boolean } {
  if (token.startsWith("$$") || token.startsWith("\\["))
    return { latex: token.slice(2, -2), display: true };
  if (token.startsWith("$")) return { latex: token.slice(1, -1), display: false };
  if (token.startsWith("\\(")) return { latex: token.slice(2, -2), display: false };
  return { latex: token, display: false };
}

export function MathSpan({ latex, display }: { latex: string; display: boolean }) {
  const html = useMemo(
    () =>
      katex.renderToString(latex, { throwOnError: false, displayMode: display }),
    [latex, display],
  );
  return (
    <span
      className={
        display
          ? "block my-2 max-w-full overflow-x-auto"
          : "inline-block max-w-full overflow-x-auto align-middle"
      }
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export type MathTextSegment =
  | { kind: "text"; text: string; start: number; end: number }
  | {
      kind: "math";
      raw: string;
      latex: string;
      display: boolean;
      start: number;
      end: number;
    };

/** Splits text into plain-text and LaTeX math segments with raw offsets. */
export function splitMathSegments(text: string): MathTextSegment[] {
  const segments: MathTextSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(MATH_RE)) {
    const idx = m.index ?? 0;
    if (idx > last)
      segments.push({ kind: "text", text: text.slice(last, idx), start: last, end: idx });
    const token = m[0];
    const { latex, display } = parseMathToken(token);
    segments.push({
      kind: "math",
      raw: token,
      latex,
      display,
      start: idx,
      end: idx + token.length,
    });
    last = idx + token.length;
  }
  if (last < text.length)
    segments.push({ kind: "text", text: text.slice(last), start: last, end: text.length });
  return segments;
}

const INLINE_CODE = /`[^`\n]+`/g;

function renderInlineCode(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(INLINE_CODE)) {
    const idx = m.index ?? 0;
    if (idx > last) nodes.push(text.slice(last, idx));
    nodes.push(
      <code
        key={key++}
        className="rounded bg-muted px-1 py-0.5 text-[0.9em] font-mono"
      >
        {m[0].slice(1, -1)}
      </code>,
    );
    last = idx + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/** Renders text with LaTeX math typeset and `inline code` styled. */
export function MathText({ text }: { text: string }) {
  return (
    <>
      {splitMathSegments(text).map((seg, i) =>
        seg.kind === "math" ? (
          <MathSpan key={i} latex={seg.latex} display={seg.display} />
        ) : (
          <React.Fragment key={i}>
            {renderInlineCode(unescapeChars(seg.text))}
          </React.Fragment>
        ),
      )}
    </>
  );
}

/** Renders inline content: LaTeX math, bold/italic/code/links, escapes. */
export function InlineMarkdown({ text }: { text: string }) {
  return <>{renderInline(text)}</>;
}

function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(MATH_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) nodes.push(...renderFormatting(text.slice(last, idx)));
    const token = m[0];
    const { latex, display } = parseMathToken(token);
    nodes.push(<MathSpan key={`math-${key++}`} latex={latex} display={display} />);
    last = idx + token.length;
  }
  if (last < text.length) nodes.push(...renderFormatting(text.slice(last)));
  return nodes;
}

function renderFormatting(rawText: string): React.ReactNode[] {
  const text = unescapeChars(rawText);
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(INLINE_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) nodes.push(text.slice(last, idx));
    const token = m[0];
    if (token.startsWith("**")) {
      nodes.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`")) {
      nodes.push(
        <code
          key={key++}
          className="rounded bg-muted px-1 py-0.5 text-[0.9em] font-mono"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("[") && m[2] && m[3]) {
      nodes.push(
        <a
          key={key++}
          href={m[3]}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2 hover:opacity-80"
        >
          {m[2]}
        </a>,
      );
    } else if (token.startsWith("*")) {
      nodes.push(<em key={key++}>{token.slice(1, -1)}</em>);
    }
    last = idx + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/**
 * Resolves a figure source to a displayable URL: http(s) URLs pass through,
 * storage object keys are signed on demand (null while pending/failed).
 */
export function useResolvedFigureUrl(src: string): string | null {
  const isKey = !/^https?:\/\//.test(src);
  const [signed, setSigned] = useState<{ src: string; url: string } | null>(
    null,
  );

  useEffect(() => {
    if (!isKey) return;
    let cancelled = false;
    signObjectKey(src)
      .then((url) => {
        if (!cancelled) setSigned({ src, url });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [src, isKey]);

  if (!isKey) return src;
  return signed?.src === src ? signed.url : null;
}

function FigureImage({ src, caption }: { src: string; caption?: string }) {
  const resolved = useResolvedFigureUrl(src);

  if (!resolved) {
    // Object key not signed yet (or signing failed) — show the caption only.
    return caption ? (
      <span className="block my-1 text-xs italic text-muted-foreground">
        [Figure: {caption}]
      </span>
    ) : null;
  }
  return (
    <span className="block my-2 overflow-hidden rounded-lg border border-border bg-card">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={resolved}
        alt={caption ?? "Figure"}
        className="w-full max-h-72 object-contain bg-muted/40"
      />
      {caption && (
        <span className="block px-3 py-1.5 text-[11px] text-muted-foreground border-t border-border">
          {caption}
        </span>
      )}
    </span>
  );
}

interface MarkdownTextProps {
  text: string;
  className?: string;
}

function renderInlineWithFigures(text: string): React.ReactNode[] {
  const combined = new RegExp(
    `${FIGURE_TOKEN.source}|${MD_IMAGE.source}|${BARE_IMAGE_URL.source}`,
    "g",
  );
  const parts: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(combined)) {
    const idx = m.index ?? 0;
    if (idx > last) parts.push(...renderInline(text.slice(last, idx)));
    const token = m[0];
    if (token.startsWith("[Figure:")) {
      parts.push(<FigureImage key={key++} src={m[1]} caption={m[2]?.trim()} />);
    } else if (token.startsWith("![")) {
      parts.push(
        <FigureImage key={key++} src={m[4]} caption={m[3] || undefined} />,
      );
    } else {
      parts.push(<FigureImage key={key++} src={token} />);
    }
    last = idx + token.length;
  }
  if (last < text.length) parts.push(...renderInline(text.slice(last)));
  return parts;
}

const HEADING_LINE = /^(#{1,4})\s+(.*)$/;
const BULLET_LINE = /^[-*]\s+(.*)$/;
const CODE_FENCE = /^```(\w*)\s*$/;

export function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  return (
    <span className="block my-2 overflow-hidden rounded-lg border border-border bg-muted/50">
      {lang && (
        <span className="block border-b border-border px-3 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          {lang}
        </span>
      )}
      <code className="block overflow-x-auto px-3 py-2.5 text-[12.5px] leading-relaxed font-mono whitespace-pre">
        {code}
      </code>
    </span>
  );
}

/**
 * Lightweight markdown renderer for generated content: headings, bullet
 * lists, and fenced ``` code blocks at block level; inline
 * bold/italic/code/links and LaTeX math; plus
 * figures — `[Figure: url — caption]` tokens, `![alt](url)` images, and bare
 * image URLs all render as inline figures.
 */
export function MarkdownText({ text, className }: MarkdownTextProps) {
  const blocks: React.ReactNode[] = [];
  const lines = text.split("\n");
  let key = 0;
  let paragraph: string[] = [];
  let bullets: string[] = [];
  let codeLines: string[] | null = null;
  let codeLang = "";

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(
      <span key={key++} className="block">
        {renderInlineWithFigures(paragraph.join("\n"))}
      </span>,
    );
    paragraph = [];
  };
  const flushBullets = () => {
    if (!bullets.length) return;
    blocks.push(
      <ul key={key++} className="my-1 list-disc space-y-0.5 pl-5">
        {bullets.map((item, i) => (
          <li key={i}>{renderInlineWithFigures(item)}</li>
        ))}
      </ul>,
    );
    bullets = [];
  };

  for (const line of lines) {
    const fence = line.match(CODE_FENCE);
    if (codeLines !== null) {
      if (fence) {
        blocks.push(
          <CodeBlock
            key={key++}
            code={codeLines.join("\n")}
            lang={codeLang || undefined}
          />,
        );
        codeLines = null;
        codeLang = "";
      } else {
        codeLines.push(line);
      }
      continue;
    }
    if (fence) {
      flushParagraph();
      flushBullets();
      codeLines = [];
      codeLang = fence[1];
      continue;
    }
    const heading = line.match(HEADING_LINE);
    const bullet = line.match(BULLET_LINE);
    if (heading) {
      flushParagraph();
      flushBullets();
      blocks.push(
        <span
          key={key++}
          className={cnHeading(heading[1].length)}
        >
          {renderInlineWithFigures(heading[2])}
        </span>,
      );
    } else if (bullet) {
      flushParagraph();
      bullets.push(bullet[1]);
    } else if (!line.trim()) {
      flushParagraph();
      flushBullets();
    } else {
      flushBullets();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushBullets();
  if (codeLines !== null)
    blocks.push(
      <CodeBlock
        key={key++}
        code={codeLines.join("\n")}
        lang={codeLang || undefined}
      />,
    );

  return <span className={className}>{blocks}</span>;
}

function cnHeading(level: number): string {
  const base = "block font-semibold text-foreground";
  if (level === 1) return `${base} text-base mt-2 mb-1`;
  if (level === 2) return `${base} text-[0.95rem] mt-2 mb-1`;
  return `${base} text-sm mt-1.5 mb-0.5`;
}
