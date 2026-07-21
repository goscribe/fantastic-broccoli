"use client";

import { useEffect, useId, useMemo, useState } from "react";

const MIN_HEIGHT = 120;
const MAX_HEIGHT = 900;

// Design tokens forwarded into the sandboxed iframe so LLM-authored
// visualizers can style themselves with the app's palette via var(--token).
const THEME_TOKENS = [
  "background",
  "foreground",
  "card",
  "muted",
  "muted-foreground",
  "accent",
  "accent-dim",
  "accent-soft",
  "accent-bright",
  "accent-foreground",
  "energy",
  "energy-soft",
  "violet",
  "sky",
  "rose",
  "amber",
  "border",
  "border-strong",
  "radius",
] as const;

// Tailwind Play CDN configured so LLM-authored markup can use utility
// classes with token-named colors (bg-accent, text-foreground, border-border,
// text-violet, ...) that resolve to the app's design tokens.
function tailwindScript(): string {
  const colorTokens = [
    "background",
    "foreground",
    "card",
    "muted",
    "muted-foreground",
    "accent",
    "accent-dim",
    "accent-soft",
    "accent-bright",
    "accent-foreground",
    "energy",
    "energy-soft",
    "violet",
    "sky",
    "rose",
    "amber",
    "border",
    "border-strong",
  ];
  const colors = Object.fromEntries(
    colorTokens.map((t) => [t, `var(--${t})`]),
  );
  return (
    `<script src="https://cdn.tailwindcss.com"></script>` +
    `<script>tailwind.config={theme:{extend:{colors:${JSON.stringify(colors)}}}}</script>`
  );
}

// Lucide icon library (same icon set as the app). Markup uses
// <i data-lucide="name"></i>; createIcons runs on load and is re-runnable
// from generated scripts after dynamic DOM updates.
function lucideScript(): string {
  return (
    `<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>` +
    `<script>window.addEventListener("load",function(){if(window.lucide)window.lucide.createIcons();});</script>`
  );
}

// KaTeX for LaTeX inside visualizers. Elements with class "math" (inline)
// or "math-display" (block) are rendered from their text content on load;
// generated scripts can call window.renderMath() after dynamic updates.
// renderMath also repairs common LLM output slips in plain text nodes:
// literal "\n" escapes become <br>, and bare undelimited LaTeX fragments
// (e.g. C_{11}, \cdot, \frac{a}{b}) are typeset even without a .math class.
function katexScript(): string {
  const repair = `
window.renderMath=function(){
  if(!window.katex)return;
  document.querySelectorAll(".math,.math-display").forEach(function(el){
    if(el.dataset.mathRendered)return;el.dataset.mathRendered="1";
    try{katex.render(el.textContent||"",el,{displayMode:el.classList.contains("math-display"),throwOnError:false});}catch(e){}
  });
  var texts=[],w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,null),n;
  while((n=w.nextNode())){
    var p=n.parentElement;
    if(!p)continue;
    var tag=p.tagName;
    if(tag==="SCRIPT"||tag==="STYLE"||tag==="TEXTAREA")continue;
    if(p.closest(".math,.math-display,.katex"))continue;
    texts.push(n);
  }
  texts.forEach(function(node){
    var t=node.nodeValue||"";
    if(t.indexOf("\\\\n")<0)return;
    var frag=document.createDocumentFragment();
    t.split("\\\\n").forEach(function(part,i){
      if(i)frag.appendChild(document.createElement("br"));
      if(part)frag.appendChild(document.createTextNode(part));
    });
    node.parentNode.replaceChild(frag,node);
  });
  texts=[];w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,null);
  while((n=w.nextNode())){
    var p2=n.parentElement;
    if(!p2)continue;
    var tag2=p2.tagName;
    if(tag2==="SCRIPT"||tag2==="STYLE"||tag2==="TEXTAREA")continue;
    if(p2.closest(".math,.math-display,.katex"))continue;
    texts.push(n);
  }
  var ANCHOR=/\\\\[a-zA-Z]{2,}|[_^]\\{/;
  var FRAG=/[A-Za-z0-9()\\[\\]+\\-=\\/]*(?:[\\^_]\\{[^{}]*\\}|\\\\[a-zA-Z]+\\{[^{}]*\\}|\\\\[a-zA-Z]{2,})(?:[\\s,]*(?:\\\\[a-zA-Z]+|[\\^_]\\{[^{}]*\\}|\\{[^{}]*\\}|[0-9()\\[\\]+\\-=*\\/.]+|[A-Za-z](?![A-Za-z]{2})))*/g;
  texts.forEach(function(node){
    var t=node.nodeValue||"";
    if(!ANCHOR.test(t))return;
    var stripped=t.replace(FRAG," ");
    var prose=/[A-Za-z]{3,}(?:\\s+[A-Za-z]{3,}){2,}/.test(stripped);
    if(!prose){
      var span=document.createElement("span");
      try{katex.render(t,span,{throwOnError:false});node.parentNode.replaceChild(span,node);}catch(e){}
      return;
    }
    var frag=document.createDocumentFragment(),last=0,m,any=false;
    FRAG.lastIndex=0;
    while((m=FRAG.exec(t))){
      if(!m[0]||!ANCHOR.test(m[0])){continue;}
      any=true;
      if(m.index>last)frag.appendChild(document.createTextNode(t.slice(last,m.index)));
      var s=document.createElement("span");
      try{katex.render(m[0].replace(/\\s+$/,""),s,{throwOnError:false});}catch(e){s.textContent=m[0];}
      frag.appendChild(s);
      last=m.index+m[0].length;
    }
    if(any){
      if(last<t.length)frag.appendChild(document.createTextNode(t.slice(last)));
      node.parentNode.replaceChild(frag,node);
    }
  });
};
window.addEventListener("load",window.renderMath);`;
  return (
    `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">` +
    `<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>` +
    `<script>${repair}</script>`
  );
}

function themeStyle(): string {
  const root = getComputedStyle(document.documentElement);
  const vars = THEME_TOKENS.map(
    (t) => `--${t}:${root.getPropertyValue(`--${t}`).trim()};`,
  ).join("");
  return `<style>:root{${vars}}
body{margin:0;font-family:ui-sans-serif,system-ui,sans-serif;color:var(--foreground);background:var(--card);}
input[type=range]{accent-color:var(--accent);}
button{font:inherit;border:1px solid var(--border);border-radius:8px;background:var(--muted);color:var(--foreground);padding:4px 10px;cursor:pointer;}
button:hover{border-color:var(--border-strong);}
button[aria-pressed=true],button.is-selected{background:var(--accent);border-color:var(--accent);color:var(--accent-foreground);}
select,input[type=text],input[type=number]{font:inherit;border:1px solid var(--border);border-radius:8px;background:var(--card);color:var(--foreground);padding:4px 8px;}
.card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:12px 14px;}
.viz-stat{display:flex;flex-direction:column;gap:2px;}
.viz-stat-value{font-size:20px;font-weight:500;font-variant-numeric:tabular-nums;}
.viz-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;}
.viz-row{display:flex;flex-wrap:wrap;align-items:center;gap:10px;}
.viz-controls{display:flex;flex-wrap:wrap;align-items:center;gap:12px;padding:8px 0;}
.viz-controls label{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--muted-foreground);}
.viz-badge{display:inline-flex;align-items:center;border-radius:999px;background:var(--accent-soft);color:var(--accent-dim);font-size:12px;font-weight:500;padding:2px 10px;}
.viz-small{font-size:12px;}
.viz-muted{color:var(--muted-foreground);}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;font:inherit;font-size:13px;font-weight:500;border:1px solid var(--border);border-radius:8px;background:var(--muted);color:var(--foreground);padding:5px 12px;cursor:pointer;}
.btn:hover{border-color:var(--border-strong);}
.btn-primary{background:var(--accent);border-color:var(--accent);color:var(--accent-foreground);}
.btn-primary:hover{background:var(--accent-dim);border-color:var(--accent-dim);}
.btn-ghost{background:transparent;border-color:transparent;}
.btn-ghost:hover{background:var(--muted);border-color:transparent;}
.form-label{display:block;font-size:13px;color:var(--muted-foreground);margin-bottom:4px;}
.form-control,.form-select{font:inherit;border:1px solid var(--border);border-radius:8px;background:var(--card);color:var(--foreground);padding:4px 8px;}
.form-range{accent-color:var(--accent);width:100%;}
.separator{border:0;border-top:1px solid var(--border);margin:10px 0;}
svg.lucide{width:16px;height:16px;stroke-width:2;vertical-align:-2px;}</style>`;
}

function resizeScript(id: string) {
  return `<script>(function(){
  function post(){parent.postMessage({type:"scribe-widget-height",id:${JSON.stringify(id)},height:document.documentElement.scrollHeight},"*");}
  if(typeof ResizeObserver!=="undefined"){new ResizeObserver(post).observe(document.documentElement);}
  window.addEventListener("load",post);
  setTimeout(post,50);
})();</script>`;
}

interface HtmlWidgetProps {
  html: string;
  title?: string;
}

/**
 * Renders LLM-authored self-contained HTML/JS visualizers in a sandboxed
 * iframe (scripts allowed, no same-origin access — the document can't reach
 * cookies, storage, or the parent app). Height auto-fits via postMessage.
 */
export function HtmlWidget({ html, title }: HtmlWidgetProps) {
  const frameId = useId();
  const [height, setHeight] = useState(320);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const d = e.data as {
        type?: string;
        id?: string;
        height?: number;
      } | null;
      if (
        d &&
        d.type === "scribe-widget-height" &&
        d.id === frameId &&
        typeof d.height === "number" &&
        Number.isFinite(d.height)
      ) {
        setHeight(Math.min(Math.max(Math.ceil(d.height), MIN_HEIGHT), MAX_HEIGHT));
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [frameId]);

  const srcDoc = useMemo(
    () => tailwindScript() + lucideScript() + katexScript() + themeStyle() + html + resizeScript(frameId),
    [html, frameId],
  );

  return (
    <figure className="my-2 overflow-hidden rounded-xl border border-border bg-card animate-fade-up">
      <iframe
        title={title ?? "Interactive visualizer"}
        sandbox="allow-scripts"
        srcDoc={srcDoc}
        style={{ height }}
        className="w-full border-0 bg-card"
      />
      {title && (
        <figcaption className="px-3.5 py-2 text-[11px] text-muted-foreground border-t border-border">
          {title}
        </figcaption>
      )}
    </figure>
  );
}
