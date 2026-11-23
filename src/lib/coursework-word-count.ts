/**
 * Counting coursework words the way the exam board does.
 *
 * A board's word limit covers the student's own prose, not everything in the
 * file: depending on the component, the title page, contents, headings,
 * tables, figures and captions, equations, code, citations, the bibliography
 * and appendices are left out. Each rubric carries its rules
 * (`wordCount.excludes`); a rubric without rules falls back to leaving out
 * the bibliography, appendices, tables and code.
 *
 * Counting is a separate pass over the work: nothing is removed from the
 * text that is reviewed (quote offsets point into it). The work is turned
 * into segments from the best structure there is:
 *
 *  - Word files: mammoth's HTML (headings, tables, images, footnote lists,
 *    contents links are real elements);
 *  - editor documents: tiptap JSON (tables, code blocks, maths, images);
 *  - PDFs and plain text: line heuristics (bibliography / appendix headings,
 *    contents lines with dot leaders, "Figure 3:" captions, code-like and
 *    table-like lines, headers and footers repeated across pages). These are
 *    deliberately conservative: when a line is not clearly something else it
 *    counts as prose.
 *
 * The same sections pass then runs over the segments: title page, contents,
 * acknowledgements, bibliography, appendices.
 *
 * This file has no imports on purpose: it is a copy of the server's
 * src/lib/coursework/word-count.ts (goscribe/server), kept identical so the
 * editor's live count and the start screen count exactly as the review will.
 * Change the server file first, then copy it here.
 */

export const WORD_COUNT_EXCLUDES = [
  'title_page',
  'contents',
  'acknowledgements',
  'headings',
  'tables',
  'figures',
  'captions',
  'equations',
  'code',
  'footnote_citations',
  'citations',
  'bibliography',
  'appendices',
] as const;
export type WordCountExclude = (typeof WORD_COUNT_EXCLUDES)[number];
/** Page headers/footers of a PDF are never the student's prose, whatever the rubric says. */
export type WordCountCategory = WordCountExclude | 'page_furniture';

export const WORD_COUNT_KINDS = ['words', 'pages', 'none'] as const;
export type WordCountKind = (typeof WORD_COUNT_KINDS)[number];

export interface WordCountRules {
  /** The word limit; null when the component has none (or a page guide). */
  limit: number | null;
  kind: WordCountKind;
  excludes: WordCountExclude[];
  /** What the count covers, in plain words, shown to the student. */
  note: string;
}

export interface ResolvedWordCountRules extends WordCountRules {
  /** True when the rubric had no rules of its own and the general fallback is used. */
  fallback: boolean;
}

export const FALLBACK_EXCLUDES: WordCountExclude[] = ['bibliography', 'appendices', 'tables', 'code'];
export const FALLBACK_NOTE =
  'General rule (this component\'s own counting rules are not loaded yet): the bibliography, appendices, tables and code are not counted. Check your subject guide for the exact rule.';

/** The rubric's stored rules, or the general fallback built from its word limit. */
export function resolveWordCountRules(stored: unknown, wordLimit: number | null): ResolvedWordCountRules {
  const s = stored as Partial<WordCountRules> | null | undefined;
  if (s && typeof s === 'object' && Array.isArray(s.excludes) && (WORD_COUNT_KINDS as readonly string[]).includes(String(s.kind))) {
    const kind = s.kind as WordCountKind;
    const limit = kind === 'words' && typeof s.limit === 'number' && s.limit > 0 ? s.limit : null;
    return {
      limit,
      kind,
      excludes: s.excludes.filter((e): e is WordCountExclude => (WORD_COUNT_EXCLUDES as readonly string[]).includes(String(e))),
      note: typeof s.note === 'string' ? s.note : '',
      fallback: false,
    };
  }
  return { limit: wordLimit, kind: wordLimit ? 'words' : 'none', excludes: [...FALLBACK_EXCLUDES], note: FALLBACK_NOTE, fallback: true };
}

export type WordCountSource = 'docx' | 'editor' | 'pdf' | 'text';

export interface WordBreakdown {
  /** Every word in the file. */
  total: number;
  /** Words that count toward the limit under the rules. */
  counted: number;
  /** total - counted. */
  notCounted: number;
  /** Words left out, by reason (only reasons that left something out). */
  excluded: Partial<Record<WordCountCategory, number>>;
  /** 'structure' = from the document's real structure; 'text' = heuristics on plain text. */
  method: 'structure' | 'text';
  /** A count from an uploaded file is an estimate; an editor document's is exact for its structure. */
  estimate: boolean;
}

const WORD = /[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu;
const words = (text: string): number => text.match(WORD)?.length ?? 0;

/* -------------------------------- Segments -------------------------------- */

type SegKind = 'heading' | 'para' | 'table' | 'code' | 'figure' | 'caption' | 'equation' | 'footnote' | 'toc' | 'furniture';

export interface Segment {
  kind: SegKind;
  text: string;
  /** Heading level (1-6) when the structure gives one. */
  level?: number;
  /** Range in the source text (text mode only). */
  start?: number;
  end?: number;
}

const CAPTION = /^(?:figure|fig\.?|table|diagram|chart|graph|image|screenshot|illustration|picture|photo|listing|equation|map|plate)\s+\d+[a-z]?(?:[.\-]\d+)*\s*(?:[:.\-–—|]|$)/i;
const DOT_LEADER = /(?:\.{4,}|…{2,}|(?:\. ){4,}|_{4,})\s*\d{1,4}\s*$/;
const ENDS_WITH_PAGE = /\S\s+\d{1,4}\s*$/;

const CODE_STRONG = [
  /[;{}]\s*$/,
  /^\s*(?:\/\/|\/\*|\*\/|<!--|#!|#include\b|@\w+\s*$)/,
  /^\s*(?:def|class)\s+\w+\s*[(:]/,
  /^\s*(?:import\s+[\w.*{},\s]+|from\s+[\w.]+\s+import\b.*|using\s+[\w.]+;?|package\s+[\w.]+;?)\s*$/,
  /^\s*(?:if|elif|while|for|with|switch|case)\b.*[()=<>\[\].].*(?::|\{)\s*$/,
  /^\s*(?:else|try|finally|do|except(?:\s+[\w.]+)?(?:\s+as\s+\w+)?)\s*(?::|\{)\s*$/,
  /^\s*(?:public|private|protected|static|final|void|function|const|let|var|return|print|println|echo|console\.log|System\.out)\b.*[(){}=;]/,
  /^\s*(?:SELECT|INSERT INTO|UPDATE|DELETE FROM|CREATE TABLE|ALTER TABLE|DROP TABLE)\b/,
  /^\s*[\w.$\[\]'"]+\s*(?:[+\-*/]?=)\s*[^=\s].*[)\]"'\d]\s*$/,
  /^\s*[\w.$]+\(.*\)\s*;?\s*$/,
  /^\s*(?:return|break|continue|pass|raise|throw|yield)\b.{0,40}$/,
  /^\s*<\/?[a-zA-Z][\w-]*(?:\s[^>]*)?>\s*$/,
  /(?:===?|!==?|=>|->|&&|\|\||\+\+|::)/,
];

function codeLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (/^[{}()\[\];]+$/.test(t)) return true;
  const n = words(t);
  // A sentence stays prose: long, and ending like one.
  if (n > 16) return false;
  if (n >= 8 && /[.!?]["”)]?$/.test(t) && !/[;{}=]/.test(t)) return false;
  return CODE_STRONG.some((re) => re.test(t));
}

/** A block of lines that is code: most lines look like code (one line must look like it strongly). */
function codeBlock(text: string): boolean {
  const lines = text.split('\n').filter((l) => l.trim());
  if (!lines.length) return false;
  const hits = lines.filter(codeLine).length;
  return lines.length === 1 ? hits === 1 : hits / lines.length >= 0.6;
}

function equationLine(line: string): boolean {
  const t = line.trim();
  if (!/[=≈≤≥±×÷∑√∫]/.test(t) || !/\d/.test(t)) return false;
  const longWords = (t.match(/\p{L}{4,}/gu) ?? []).length;
  return longWords <= 3 && words(t) <= 30 && !/[.!?]$/.test(t.replace(/\d\.$/, ''));
}

function tableLine(line: string): boolean {
  if (/ \| /.test(line) || /^\s*\|\s/.test(line)) return true;
  const cells = line.trim().split(/\t+| {3,}/).filter(Boolean);
  if (cells.length >= 3 && cells.every((c) => words(c) <= 6)) return true;
  const tokens = line.trim().split(/\s+/);
  const numeric = tokens.filter((t) => /^[-+±]?\d[\d.,]*%?$/.test(t)).length;
  return tokens.length >= 4 && numeric / tokens.length >= 0.7;
}

const REF_LIKE = /https?:|www\.|\bdoi\b|\bibid\b|\bop\. ?cit|\bpp?\.\s*\d|\b(?:1[5-9]|20)\d{2}[a-z]?\b|\bet al\b|\baccessed\b|\bretrieved\b|\bn\.d\.|\bvol\.|\bed\.|\bpress\b/i;

/** Pulls `$$…$$`, maths-like `$…$` and `[figure…]` markers (the editor's plain-text forms) out of prose. */
function splitInlineMarkers(text: string, out: Segment[]): string {
  return text
    .replace(/\[figure(?::([^\]]*))?\]/g, (_m, alt: string | undefined) => {
      out.push({ kind: 'figure', text: alt ?? '' });
      return ' ';
    })
    .replace(/\$\$[\s\S]*?\$\$/g, (m) => {
      out.push({ kind: 'equation', text: m });
      return ' ';
    })
    .replace(/\$(?=[^$\n]*[\\^_={}])[^$\n]{1,400}\$/g, (m) => {
      out.push({ kind: 'equation', text: m });
      return ' ';
    });
}

/** Prose blocks that are really a caption, code, a contents line or an equation. */
function refine(seg: Segment, out: Segment[]): void {
  if (seg.kind !== 'para') {
    out.push(seg);
    return;
  }
  const text = splitInlineMarkers(seg.text, out);
  const t = text.trim();
  if (!t) return;
  let kind: SegKind = 'para';
  if (DOT_LEADER.test(t)) kind = 'toc';
  else if (CAPTION.test(t) && words(t) <= 45) kind = 'caption';
  else if (codeBlock(t)) kind = 'code';
  else if (!t.includes('\n') && equationLine(t)) kind = 'equation';
  out.push({ ...seg, kind, text });
}

/* ---------------------------------- HTML ---------------------------------- */

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s: string) =>
  s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });

const attrOf = (attrs: string, name: string): string | null => new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i').exec(attrs)?.[1] ?? null;

/** Segments of simple, well-formed HTML (mammoth's output for a Word file). */
export function segmentsFromHtml(html: string): Segment[] {
  const raw: Segment[] = [];
  const tag = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g;
  let buf = '';
  let last = 0;
  let table = 0;
  let pre = 0;
  let heading = 0;
  let footnote = 0;
  let li = 0;
  let skip = 0;
  let toc = false;
  const flush = () => {
    const text = decode(buf).replace(/[ \t ]+/g, ' ').replace(/ ?\n ?/g, '\n').trim();
    buf = '';
    const wasToc = toc;
    toc = false;
    if (!text) return;
    if (table) raw.push({ kind: 'table', text });
    else if (pre) raw.push({ kind: 'code', text });
    else if (footnote) raw.push({ kind: 'footnote', text });
    else if (heading) raw.push({ kind: 'heading', text, level: heading });
    else if (wasToc && (ENDS_WITH_PAGE.test(text) || words(text) <= 15)) raw.push({ kind: 'toc', text });
    else raw.push({ kind: 'para', text });
  };
  for (let m = tag.exec(html); m; m = tag.exec(html)) {
    if (!skip) buf += html.slice(last, m.index);
    last = m.index + m[0].length;
    const close = m[1] === '/';
    const name = m[2].toLowerCase();
    const attrs = m[3];
    if (name === 'script' || name === 'style') {
      skip += close ? -1 : 1;
      skip = Math.max(0, skip);
      continue;
    }
    if (skip) continue;
    switch (name) {
      case 'table':
        flush();
        table = Math.max(0, table + (close ? -1 : 1));
        break;
      case 'pre':
        flush();
        pre = Math.max(0, pre + (close ? -1 : 1));
        break;
      case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6':
        flush();
        heading = close ? 0 : Number(name[1]);
        break;
      case 'li':
        flush();
        if (!close) {
          li++;
          if (!footnote && /^(?:foot|end)note-\d+$/.test(attrOf(attrs, 'id') ?? '')) footnote = li;
        } else {
          if (footnote === li) footnote = 0;
          li = Math.max(0, li - 1);
        }
        break;
      case 'p': case 'div': case 'blockquote': case 'ul': case 'ol': case 'tr': case 'figure': case 'figcaption':
        if (table) buf += ' ';
        else flush();
        break;
      case 'td': case 'th':
        buf += ' ';
        break;
      case 'br':
        buf += '\n';
        break;
      case 'img':
        raw.push({ kind: 'figure', text: decode(attrOf(attrs, 'alt') ?? '') });
        break;
      case 'a': {
        const href = attrOf(attrs, 'href') ?? '';
        // A contents entry links to a heading bookmark; a note marker ("[1]") is not a word of the essay.
        if (!close && /^#_(?:Toc|heading)/i.test(href)) toc = true;
        if (!close && /^#(?:foot|end)note-\d+$/.test(href)) {
          const end = html.indexOf('</a>', last);
          if (end >= 0) {
            last = end + 4;
            tag.lastIndex = last;
          }
        }
        break;
      }
      default:
        break;
    }
  }
  buf += html.slice(last);
  flush();
  const out: Segment[] = [];
  for (const s of raw) refine(s, out);
  return joinCode(out);
}

/**
 * Word has no code blocks: a listing is a run of one-line paragraphs. A short
 * line that is not a sentence, sitting between two code lines, is code too
 * ("pass", "total += used").
 */
function joinCode(segs: Segment[]): Segment[] {
  return segs.map((s, i) => {
    if (s.kind !== 'para' || segs[i - 1]?.kind !== 'code' || segs[i + 1]?.kind !== 'code') return s;
    const t = s.text.trim();
    return words(t) <= 8 && !/[.!?]["”)]?$/.test(t) ? { ...s, kind: 'code' as const } : s;
  });
}

/* --------------------------------- tiptap --------------------------------- */

interface Node {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: Node[];
}

const nodeAttr = (n: Node, key: string): string => (typeof n.attrs?.[key] === 'string' ? (n.attrs[key] as string).trim() : '');

function inlineText(nodes: Node[] | undefined, out: Segment[], depth: number): string {
  if (!nodes || depth > 40) return '';
  let s = '';
  for (const n of nodes) {
    switch (n.type) {
      case 'text':
        s += n.text ?? '';
        break;
      case 'hardBreak':
        s += '\n';
        break;
      case 'inlineMath':
      case 'mathInline':
        out.push({ kind: 'equation', text: nodeAttr(n, 'latex') });
        s += ' ';
        break;
      case 'image':
        out.push({ kind: 'figure', text: nodeAttr(n, 'alt') || nodeAttr(n, 'title') });
        break;
      case 'footnote':
      case 'footnoteReference':
        break;
      default:
        s += inlineText(n.content, out, depth + 1) || (n.text ?? '');
    }
  }
  return s;
}

function allText(n: Node, depth = 0): string {
  if (depth > 40) return '';
  if (n.type === 'text') return n.text ?? '';
  const latex = nodeAttr(n, 'latex');
  const own = latex || nodeAttr(n, 'alt');
  const sep = n.type === 'tableRow' || n.type === 'paragraph' || n.type === 'tableCell' || n.type === 'tableHeader' ? ' ' : '';
  return `${own}${(n.content ?? []).map((c) => allText(c, depth + 1)).join(sep)}${sep}`;
}

function walk(n: Node, out: Segment[], depth: number): void {
  if (depth > 40) return;
  switch (n.type) {
    case 'heading': {
      const t = inlineText(n.content, out, depth + 1).trim();
      if (t) out.push({ kind: 'heading', text: t, level: typeof n.attrs?.level === 'number' ? (n.attrs.level as number) : 2 });
      return;
    }
    case 'paragraph': {
      const t = inlineText(n.content, out, depth + 1).trim();
      if (t) refine({ kind: 'para', text: t }, out);
      return;
    }
    case 'blockMath':
    case 'mathBlock':
      out.push({ kind: 'equation', text: nodeAttr(n, 'latex') });
      return;
    case 'image':
    case 'figure': {
      const caption = inlineText(n.content, out, depth + 1).trim();
      out.push({ kind: 'figure', text: nodeAttr(n, 'alt') || nodeAttr(n, 'title') });
      if (caption) out.push({ kind: 'caption', text: caption });
      return;
    }
    case 'codeBlock':
      out.push({ kind: 'code', text: allText(n) });
      return;
    case 'table':
      out.push({ kind: 'table', text: allText(n) });
      return;
    case 'footnotes':
    case 'footnote':
      out.push({ kind: 'footnote', text: allText(n) });
      return;
    case 'horizontalRule':
      return;
    default:
      if (n.content?.some((c) => c.type === 'text')) {
        const t = inlineText(n.content, out, depth + 1).trim();
        if (t) refine({ kind: 'para', text: t }, out);
        return;
      }
      for (const c of n.content ?? []) walk(c, out, depth + 1);
  }
}

/** Segments of an editor document (tiptap JSON). */
export function segmentsFromDoc(doc: unknown): Segment[] {
  const out: Segment[] = [];
  if (doc && typeof doc === 'object') walk(doc as Node, out, 0);
  return out;
}

/* ------------------------------- Plain text ------------------------------- */

export interface PageSpan {
  page: number;
  start: number;
  end: number;
  /** Ranges of the text the PDF's layout shows to be table rows (file-extract.ts). */
  tables?: Array<[number, number]>;
}

const SECTION_LINE_MAX_WORDS = 9;
const BIB_HEADING = /^(?:\d+(?:\.\d+)*\.?\s+|[IVX]+\.\s+)?(?:bibliography|works cited|works consulted|references|reference list|list of references|sources|list of sources|sources cited|literature cited)\s*:?$/i;
const APPENDIX_HEADING = /^(?:\d+(?:\.\d+)*\.?\s+|[IVX]+\.\s+)?(?:appendix|appendices|annex|annexes|annexe)(?:\s+[A-Z0-9]{1,4})?(?:\s*[:.\-–—]\s*.{0,90}|\s+\(.{0,60}\))?$/i;
const CONTENTS_HEADING = /^(?:table of contents|contents|contents page|index|list of (?:figures|tables|illustrations)|table of figures)\s*:?$/i;
const ACK_HEADING = /^acknowledge?ments?\s*:?$/i;

const sectionHeading = (t: string): boolean => BIB_HEADING.test(t) || APPENDIX_HEADING.test(t) || CONTENTS_HEADING.test(t) || ACK_HEADING.test(t);

const HEADING_LINE = /^(?:(?:\d+(?:\.\d+)*\.?|[IVX]+\.|Chapter \d+|Section \d+|Criterion [A-G]|Part [A-Z0-9]+)[\s:.\-–—]*)?\p{Lu}[^.!?;|]{0,90}$/u;

function headingLine(line: string, next: string | undefined): boolean {
  const n = words(line);
  if (n === 0 || n > 10 || !HEADING_LINE.test(line)) return false;
  if (/[,:]$/.test(line) || /\b(?:the|a|an|of|and|to|in|with|for|is|are|was)$/i.test(line)) return false;
  // Stands alone: the next line does not continue it.
  return next === undefined || next === '' || !/^\p{Ll}/u.test(next);
}

/** Lines repeated at the top or bottom of most pages (running headers, footers, page numbers). */
function furnitureLines(text: string, pages: PageSpan[]): Set<number> {
  const out = new Set<number>();
  if (pages.length < 2) return out;
  const key = (l: string) => l.trim().toLowerCase().replace(/\d+/g, '#');
  const edges: Array<Array<{ start: number; text: string }>> = pages.map((p) => {
    const lines: Array<{ start: number; text: string }> = [];
    let at = p.start;
    for (const l of text.slice(p.start, p.end).split('\n')) {
      if (l.trim()) lines.push({ start: at, text: l });
      at += l.length + 1;
    }
    return lines.length <= 4 ? lines : [...lines.slice(0, 2), ...lines.slice(-2)];
  });
  const seen = new Map<string, number>();
  for (const page of edges) for (const k of new Set(page.map((l) => key(l.text)))) seen.set(k, (seen.get(k) ?? 0) + 1);
  const need = Math.max(3, Math.ceil(pages.length * 0.4));
  for (const page of edges) {
    for (const l of page) {
      const t = l.text.trim();
      const pageNumber = /^(?:page\s*)?\d{1,4}(?:\s*(?:of|\/)\s*\d{1,4})?$/i.test(t) || /^[-–—]\s*\d{1,4}\s*[-–—]$/.test(t);
      if (pageNumber || (words(t) <= 14 && (seen.get(key(l.text)) ?? 0) >= need)) out.add(l.start);
    }
  }
  return out;
}

/** Segments of plain text (PDF text, pasted text, the editor's or a Word file's text), with offsets. */
export function segmentsFromText(text: string, pages?: PageSpan[] | null): Segment[] {
  const furniture = pages?.length ? furnitureLines(text, pages) : new Set<number>();
  const lines: Array<{ text: string; start: number }> = [];
  let at = 0;
  for (const l of text.split('\n')) {
    lines.push({ text: l, start: at });
    at += l.length + 1;
  }
  const tables = (pages ?? []).flatMap((p) => p.tables ?? []);
  let tableAt = 0;
  const inTable = (start: number): boolean => {
    while (tableAt < tables.length && tables[tableAt][1] <= start) tableAt++;
    return tableAt < tables.length && start >= tables[tableAt][0];
  };
  const raw: Segment[] = [];
  let para: { text: string; start: number; end: number } | null = null;
  const flush = () => {
    if (para) raw.push({ kind: 'para', text: para.text, start: para.start, end: para.end });
    para = null;
  };
  const neighbour = (i: number, step: number): string | undefined => {
    for (let j = i + step; j >= 0 && j < lines.length; j += step) {
      if (!furniture.has(lines[j].start)) return lines[j].text.trim();
    }
    return undefined;
  };
  lines.forEach((line, i) => {
    const t = line.text.trim();
    const end = line.start + line.text.length;
    if (!t) return flush();
    if (furniture.has(line.start)) {
      // Furniture sits between two halves of a paragraph that runs over the page: do not break it.
      raw.push({ kind: 'furniture', text: t, start: line.start, end });
      return;
    }
    let kind: SegKind | null = null;
    if (words(t) <= SECTION_LINE_MAX_WORDS + 6 && sectionHeading(t)) kind = 'heading';
    else if (DOT_LEADER.test(t)) kind = 'toc';
    else if (CAPTION.test(t) && words(t) <= 45) kind = 'caption';
    else if (inTable(line.start + (line.text.length - line.text.trimStart().length)) || tableLine(line.text)) kind = 'table';
    else if (codeLine(line.text)) kind = 'code';
    else if (equationLine(t)) kind = 'equation';
    // A reference footnote at the foot of a PDF page: "12 Smith, J. (2019) …", "3 Ibid., p. 4".
    else if (/^\d{1,3}\s?\p{Lu}/u.test(t) && !/^\d{1,2}\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/.test(t) && REF_LIKE.test(t) && words(t) >= 5 && words(t) <= 60) kind = 'footnote';
    // A heading stands alone: after a blank line or another heading, or after a line that ended a sentence.
    else if ((!para || /[.!?"”)]$/.test(para.text)) && headingLine(t, neighbour(i, 1))) kind = 'heading';
    if (kind) {
      flush();
      raw.push({ kind, text: t, start: line.start, end });
      return;
    }
    if (para) {
      para.text += `\n${t}`;
      para.end = end;
    } else para = { text: t, start: line.start, end };
  });
  flush();
  const out: Segment[] = [];
  for (const s of raw) {
    if (s.kind !== 'para') {
      out.push(s);
      continue;
    }
    // Lines were classified one by one above; only the inline markers are left to pull out.
    const extra: Segment[] = [];
    const rest = splitInlineMarkers(s.text, extra);
    out.push({ ...s, text: rest }, ...extra.map((e) => ({ ...e, start: s.start, end: s.start })));
  }
  return out;
}

/* -------------------------------- Sections -------------------------------- */

type Section = 'body' | 'contents' | 'acknowledgements' | 'bibliography' | 'appendices';

interface Classified {
  seg: Segment;
  category: WordCountCategory | 'body';
  words: number;
}

const PROSE_MIN_WORDS = 30;
const TITLE_PAGE_MAX_WORDS = 150;

/** A first heading that names a section is not the work's title. */
const FIRST_SECTION = /^(?:\d+(?:\.\d+)*\.?\s|[IVX]+\.\s|(?:introduction|abstract|background|aims?|research question|method(?:ology)?|planning|overview|summary|rationale|context|criterion|section|chapter|part|identification)\b)/i;

function isSection(seg: Segment, re: RegExp): boolean {
  if (seg.kind !== 'heading' && seg.kind !== 'para') return false;
  const t = seg.text.trim();
  return !t.includes('\n') && words(t) <= SECTION_LINE_MAX_WORDS + 6 && re.test(t);
}

const KIND_CATEGORY: Record<SegKind, WordCountCategory | 'body'> = {
  heading: 'headings',
  para: 'body',
  table: 'tables',
  code: 'code',
  figure: 'figures',
  caption: 'captions',
  equation: 'equations',
  footnote: 'body',
  toc: 'contents',
  furniture: 'page_furniture',
};

function classify(segs: Segment[], structured: boolean): Classified[] {
  const counts = segs.map((s) => words(s.text));
  const total = counts.reduce((a, b) => a + b, 0);
  const before: number[] = [];
  counts.reduce((a, b, i) => ((before[i] = a), a + b), 0);

  // Plain text gives no heading levels: only the LAST bibliography heading starts the list, and only
  // with real work before it (a "References" line early on is more likely a section about sources).
  let textBibAt = -1;
  if (!structured) {
    for (let i = segs.length - 1; i >= 0; i--) {
      if (isSection(segs[i], BIB_HEADING)) {
        if (before[i] >= total * 0.25) textBibAt = i;
        break;
      }
    }
  }

  const out: Classified[] = [];
  let section: Section = 'body';
  let bibLevel: number | undefined;
  segs.forEach((seg, i) => {
    const n = counts[i];
    if (seg.kind === 'furniture') {
      out.push({ seg, category: 'page_furniture', words: n });
      return;
    }
    const enoughBefore = before[i] >= Math.max(50, total * 0.1);
    // "Appendices 14" inside a contents list is an entry, not the appendices.
    const contentsEntry = section === 'contents' && (seg.kind === 'toc' || ENDS_WITH_PAGE.test(seg.text.trim()));
    if (!contentsEntry && isSection(seg, APPENDIX_HEADING) && (section === 'appendices' || section === 'bibliography' || enoughBefore) && (structured ? seg.kind === 'heading' || words(seg.text) <= 6 : true)) {
      section = 'appendices';
    } else if (!contentsEntry && isSection(seg, BIB_HEADING) && (structured ? before[i] >= total * 0.25 : i === textBibAt)) {
      section = 'bibliography';
      bibLevel = seg.kind === 'heading' ? seg.level : undefined;
    } else if (isSection(seg, CONTENTS_HEADING) && section === 'body' && before[i] <= Math.max(TITLE_PAGE_MAX_WORDS, total * 0.15)) {
      section = 'contents';
    } else if (isSection(seg, ACK_HEADING) && section !== 'appendices' && section !== 'bibliography') {
      section = 'acknowledgements';
    } else if (section === 'contents') {
      // A contents list is entries: links / dot leaders / short lines ending in a page number.
      const entry = seg.kind === 'toc' || ((seg.kind === 'para' || seg.kind === 'heading' || seg.kind === 'table') && n <= 16 && ENDS_WITH_PAGE.test(seg.text.trim()));
      if (!entry) section = 'body';
    } else if (section === 'acknowledgements') {
      if (seg.kind === 'heading') section = 'body';
    } else if (section === 'bibliography' && structured) {
      if (seg.kind === 'heading' && bibLevel !== undefined && (seg.level ?? 9) <= bibLevel) section = 'body';
    }
    let category: WordCountCategory | 'body' = section === 'body' ? KIND_CATEGORY[seg.kind] : section;
    // Word puts the notes list after everything else (after the appendices): a note belongs to the body it annotates.
    if (seg.kind === 'footnote' && (structured || section === 'body')) category = REF_LIKE.test(seg.text) ? 'footnote_citations' : 'body';
    out.push({ seg, category, words: n });
  });

  markTitlePage(out);
  return out;
}

/**
 * The leading title page: everything before a contents list near the start,
 * or the short lines (title, name, candidate number, session, "Word count: …")
 * before the first paragraph of prose. A heading right before that paragraph
 * is the first section's heading, not the title page.
 */
function markTitlePage(items: Classified[]): void {
  const firstContents = items.findIndex((c) => c.category === 'contents');
  const lead = (end: number) => items.slice(0, end).filter((c) => c.category !== 'page_furniture');
  if (firstContents > 0) {
    const l = lead(firstContents);
    if (l.every((c) => c.category === 'body' || c.category === 'headings' || c.category === 'figures') && l.reduce((n, c) => n + c.words, 0) <= TITLE_PAGE_MAX_WORDS) {
      for (const c of l) c.category = 'title_page';
    }
    return;
  }
  const candidates: Classified[] = [];
  for (const c of items) {
    if (c.category === 'page_furniture') continue;
    const short = (c.seg.kind === 'para' || c.seg.kind === 'heading' || c.seg.kind === 'figure') && (c.category === 'body' || c.category === 'headings' || c.category === 'figures') && c.words <= 25 && !(c.seg.kind === 'para' && c.words >= 12 && /[.!?]$/.test(c.seg.text.trim()));
    if (!short) {
      // The lead only is a title page when real prose follows it.
      if (!(c.seg.kind === 'para' && c.words >= PROSE_MIN_WORDS)) return;
      break;
    }
    candidates.push(c);
    if (candidates.length > 20) return;
  }
  if (!candidates.length || candidates.reduce((n, c) => n + c.words, 0) > 120) return;
  let end = candidates.length;
  if (candidates.every((c) => c.seg.kind === 'heading')) end = FIRST_SECTION.test(candidates[0].seg.text.trim()) ? 0 : 1;
  else while (end > 1 && candidates[end - 1].seg.kind === 'heading') end--;
  for (const c of candidates.slice(0, end)) c.category = 'title_page';
}

/* --------------------------------- Counting -------------------------------- */

const PAREN_CITATION = /\((?:[^()]{0,90}?(?:\b(?:1[5-9]|20)\d{2}[a-z]?\b|\bn\.d\.|\bpp?\.\s*\d+)[^()]{0,40}|(?:\p{Lu}[\p{L}'’\-]+(?:,? (?:and|&) \p{Lu}[\p{L}'’\-]+| et al\.?)?,? )\d{1,4}(?:[-–]\d{1,4})?)\)/gu;
const NUMERIC_CITATION = /\[\d{1,3}(?:\s*[,–-]\s*\d{1,3})*\]/g;

/** Words inside in-text citations: "(Smith, 2019, p. 4)", "(Smith 23)", "[4]". */
export function citationWords(text: string): number {
  let n = 0;
  for (const m of text.matchAll(PAREN_CITATION)) n += words(m[0]);
  for (const m of text.matchAll(NUMERIC_CITATION)) n += words(m[0]);
  return n;
}

function tally(items: Classified[], rules: Pick<WordCountRules, 'excludes'>, method: WordBreakdown['method'], estimate: boolean): WordBreakdown {
  const excludes = new Set<string>(rules.excludes);
  const excluded: Partial<Record<WordCountCategory, number>> = {};
  let total = 0;
  let counted = 0;
  const leave = (cat: WordCountCategory, n: number) => {
    if (n > 0) excluded[cat] = (excluded[cat] ?? 0) + n;
  };
  for (const c of items) {
    total += c.words;
    if (c.category === 'page_furniture') leave('page_furniture', c.words);
    else if (c.category !== 'body' && excludes.has(c.category)) leave(c.category, c.words);
    else {
      const cites = excludes.has('citations') && c.seg.kind !== 'heading' ? Math.min(c.words, citationWords(c.seg.text)) : 0;
      leave('citations', cites);
      counted += c.words - cites;
    }
  }
  return { total, counted, notCounted: total - counted, excluded, method, estimate };
}

export interface CountInput {
  /** Word file: the HTML mammoth made of it. */
  html?: string | null;
  /** Editor document: tiptap JSON. */
  doc?: unknown;
  /** Plain text (PDF text, pasted text), used when there is no structure. */
  text?: string | null;
  /** Page ranges of a PDF inside `text`, for header/footer detection. */
  pages?: PageSpan[] | null;
  /** True when the work is an uploaded file (the count is then an estimate even with structure). */
  file?: boolean;
}

/** The word count of a piece of work under a rubric's counting rules. */
export function countWork(input: CountInput, rules: Pick<WordCountRules, 'excludes'>): WordBreakdown {
  if (input.html) return tally(classify(segmentsFromHtml(input.html), true), rules, 'structure', true);
  if (input.doc && typeof input.doc === 'object') return tally(classify(segmentsFromDoc(input.doc), true), rules, 'structure', Boolean(input.file));
  return tally(classify(segmentsFromText(input.text ?? '', input.pages), false), rules, 'text', true);
}

export interface WorkSplit {
  /** Everything before the bibliography and appendices (offsets are those of the full text). */
  body: string;
  bibliography: string | null;
  appendices: string | null;
}

/**
 * The plain text split into the body and its trailing bibliography and
 * appendices, for the grader: the body is reviewed in full, the rest is
 * passed separately as context. `body` is a prefix of `text`, so offsets hold.
 */
export function splitWork(text: string, pages?: PageSpan[] | null): WorkSplit {
  const items = classify(segmentsFromText(text, pages), false);
  const tail = items.findIndex((c) => c.category === 'bibliography' || c.category === 'appendices');
  if (tail < 0 || items[tail].seg.start === undefined) return { body: text, bibliography: null, appendices: null };
  const part = (cat: 'bibliography' | 'appendices'): string | null => {
    const own = items.filter((c) => c.category === cat);
    if (!own.length) return null;
    // Sections are contiguous runs; join the source ranges so the original line breaks are kept.
    const runs: string[] = [];
    let runStart = -1;
    let runEnd = -1;
    items.forEach((c) => {
      if (c.category === cat || (c.category === 'page_furniture' && runStart >= 0)) {
        if (c.category === cat) {
          if (runStart < 0) runStart = c.seg.start ?? 0;
          runEnd = Math.max(runEnd, c.seg.end ?? runEnd);
        }
      } else if (runStart >= 0) {
        runs.push(text.slice(runStart, runEnd));
        runStart = -1;
      }
    });
    if (runStart >= 0) runs.push(text.slice(runStart, runEnd));
    return runs.join('\n\n').trim() || null;
  };
  const stripHeading = (s: string | null) => (s === null ? null : s.replace(/^[^\n]*\n?/, (first) => (BIB_HEADING.test(first.trim()) ? '' : first)).trim());
  return { body: text.slice(0, items[tail].seg.start), bibliography: stripHeading(part('bibliography')), appendices: part('appendices') };
}

/* --------------------------------- Wording -------------------------------- */

export const CATEGORY_LABEL: Record<WordCountCategory, string> = {
  title_page: 'title page',
  contents: 'contents',
  acknowledgements: 'acknowledgements',
  headings: 'headings',
  tables: 'tables',
  figures: 'figures',
  captions: 'captions',
  equations: 'equations',
  code: 'code',
  footnote_citations: 'reference footnotes',
  citations: 'citations',
  bibliography: 'bibliography',
  appendices: 'appendices',
  page_furniture: 'page headers and footers',
};

/** "tables, code, appendices, bibliography": the reasons that left most words out first. */
export function excludedSummary(b: Pick<WordBreakdown, 'excluded'>, max = 6): string {
  return (Object.entries(b.excluded) as Array<[WordCountCategory, number]>)
    .filter(([, n]) => n > 0)
    .sort((a, c) => c[1] - a[1])
    .slice(0, max)
    .map(([k]) => CATEGORY_LABEL[k])
    .join(', ');
}

export interface LimitCheck {
  /** The count the limit is checked against: the student's own, else the estimate. */
  used: number;
  source: 'declared' | 'estimate';
  limit: number | null;
  over: boolean;
  overBy: number;
}

export function checkLimit(rules: Pick<WordCountRules, 'limit' | 'kind'>, counted: number, declared?: number | null): LimitCheck {
  const limit = rules.kind === 'words' ? rules.limit : null;
  const has = typeof declared === 'number' && declared > 0;
  const used = has ? declared! : counted;
  const overBy = limit !== null ? Math.max(0, used - limit) : 0;
  return { used, source: has ? 'declared' : 'estimate', limit, over: overBy > 0, overBy };
}
