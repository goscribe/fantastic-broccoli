"use client";

import React from "react";

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

function renderInline(text: string): React.ReactNode[] {
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

function FigureImage({ src, caption }: { src: string; caption?: string }) {
  if (!/^https?:\/\//.test(src)) {
    // Bare object key we can't sign client-side — show the caption only.
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
        src={src}
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

/**
 * Lightweight markdown renderer for generated activity content: inline
 * bold/italic/code/links, plus figures — `[Figure: url — caption]` tokens,
 * `![alt](url)` images, and bare image URLs all render as inline figures.
 */
export function MarkdownText({ text, className }: MarkdownTextProps) {
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

  return <span className={className}>{parts}</span>;
}
