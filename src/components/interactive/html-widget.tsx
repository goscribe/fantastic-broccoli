"use client";

import { useEffect, useId, useMemo, useState } from "react";
import {
  reportRenderIssue,
  type RenderIssueSurface,
} from "@/lib/api/copilot";
import { MathText } from "@/components/ui/markdown-text";
import { BrokenBlock } from "@/components/content/content-repair";
import katex from "katex";
import { prerenderFigureMath, type RenderTex } from "@/lib/figure-math";

// Maths in the markup is typeset here, before the iframe exists, so it never
// waits on (or depends on) the in-frame KaTeX script.
const renderTex: RenderTex = (tex, display) => {
  try {
    return katex.renderToString(tex, { throwOnError: true, displayMode: display });
  } catch {
    return null;
  }
};

const MIN_HEIGHT = 60;
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
// or "math-display" (block) are rendered from their text content on load,
// and re-rendered whenever a script overwrites that text (an element with no
// .katex child is unrendered); a MutationObserver re-runs renderMath after
// any DOM change so dynamic updates typeset even when the generated script
// never calls window.renderMath().
// renderMath also repairs common LLM output slips in plain text nodes:
// literal "\n" escapes become <br>, $...$/$$...$$ delimited math is typeset,
// and bare undelimited LaTeX fragments (e.g. C_{11}, \cdot, \frac{a}{b})
// are typeset even without a .math class.
function katexScript(id: string) {
  const repair = `
var mathRendering=false;
window.renderMath=function(){
  if(!window.katex||mathRendering)return;
  mathRendering=true;
  try{renderMathNow();}finally{mathRendering=false;}
};
function renderMathNow(){
  document.querySelectorAll(".math,.math-display,.math-inline,.latex,.tex").forEach(function(el){
    if(el.querySelector(".katex"))return;
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
    var pd=n.parentElement;
    if(!pd)continue;
    var tagd=pd.tagName;
    if(tagd==="SCRIPT"||tagd==="STYLE"||tagd==="TEXTAREA")continue;
    if(pd.closest(".math,.math-display,.katex"))continue;
    texts.push(n);
  }
  var DOLLAR=/\\$\\$([\\s\\S]+?)\\$\\$|\\\\\\[([\\s\\S]+?)\\\\\\]|\\\\\\(([\\s\\S]+?)\\\\\\)|\\$([^$\\n]+?)\\$/g;
  texts.forEach(function(node){
    var t=node.nodeValue||"";
    if(t.indexOf("$")<0&&t.indexOf("\\\\(")<0&&t.indexOf("\\\\[")<0)return;
    DOLLAR.lastIndex=0;
    var frag=document.createDocumentFragment(),last=0,m,any=false;
    while((m=DOLLAR.exec(t))){
      any=true;
      if(m.index>last)frag.appendChild(document.createTextNode(t.slice(last,m.index)));
      var s=document.createElement("span");
      var latex=m[1]!=null?m[1]:m[2]!=null?m[2]:m[3]!=null?m[3]:m[4];
      try{katex.render(latex,s,{displayMode:m[1]!=null||m[2]!=null,throwOnError:false});}catch(e){s.textContent=m[0];}
      frag.appendChild(s);
      last=m.index+m[0].length;
    }
    if(any){
      if(last<t.length)frag.appendChild(document.createTextNode(t.slice(last)));
      node.parentNode.replaceChild(frag,node);
    }
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
var qualityTimer=0,qualitySent={};
function qualityCheck(){
  if(!window.katex)return;
  var unrendered=[];
  document.querySelectorAll(".math,.math-display,.math-inline,.latex,.tex").forEach(function(el){
    var t=(el.textContent||"").trim();
    if(t&&!el.querySelector(".katex"))unrendered.push(t);
  });
  var bare=[];
  var walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  var BARE=/\\\\[a-zA-Z]{2,}\\{|(?:^|[^\\\\$])\\$[^$\\n]{1,80}\\$/;
  var n;
  while((n=walker.nextNode())){
    var p=n.parentElement;
    if(!p||p.closest("script,style,textarea,.math,.math-display,.katex"))continue;
    var v=n.nodeValue||"";
    if(BARE.test(v))bare.push(v.trim());
  }
  function send(kind,list){
    if(!list.length||qualitySent[kind])return;
    qualitySent[kind]=true;
    parent.postMessage({type:"scribe-widget-quality",id:${JSON.stringify(id)},kind:kind,count:list.length,sample:list.slice(0,3).join(" | ").slice(0,300)},"*");
  }
  send("unrendered_math",unrendered);
  send("bare_latex",bare);
}
function scheduleQuality(){
  clearTimeout(qualityTimer);
  qualityTimer=setTimeout(qualityCheck,600);
}
window.addEventListener("load",function(){
  window.renderMath();
  scheduleQuality();
  var raf=0;
  new MutationObserver(function(){
    if(mathRendering||raf)return;
    raf=requestAnimationFrame(function(){raf=0;window.renderMath();scheduleQuality();});
  }).observe(document.body,{childList:true,characterData:true,subtree:true});
  document.addEventListener("input",scheduleQuality,true);
  document.addEventListener("click",scheduleQuality,true);
});`;
  return (
    `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.17.0/dist/katex.min.css">` +
    `<script defer src="https://cdn.jsdelivr.net/npm/katex@0.17.0/dist/katex.min.js"></script>` +
    `<script>${repair}</script>`
  );
}

// Figure style system: the palette study-note figures are drawn in. Figures
// carry the light values as fallbacks (fill="var(--fig-blue-fill,#D9E8FF)"),
// so only the dark theme has to override them here. Mirror of FIGURE_TOKENS
// in the server's src/lib/notes/figure-style.ts; change both together.
const FIGURE_DARK_TOKENS: Record<string, string> = {
  ink: "#F2F1F5",
  muted: "#AAA6B8",
  line: "#C9C5D6",
  guide: "#55516A",
  paper: "#18171E",
  "blue-fill": "#1C3256",
  blue: "#74A7F7",
  "red-fill": "#4A2420",
  red: "#F27F73",
  "green-fill": "#173D2B",
  green: "#4FC88E",
  "amber-fill": "#44330F",
  amber: "#E3A93C",
  "violet-fill": "#2C2552",
  violet: "#A394EC",
  "neutral-fill": "#2A2836",
  neutral: "#9A95A8",
};

// Figures are typeset in the app's font. The frame is sandboxed (opaque
// origin), so it cannot reuse the page's self-hosted font files and loads
// the same family from Google Fonts instead, like its other CDN assets.
const FIGURE_FONT_LINK =
  `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` +
  `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito:wght@600;700&display=swap">`;

function themeStyle(): string {
  const root = getComputedStyle(document.documentElement);
  const vars = THEME_TOKENS.map(
    (t) => `--${t}:${root.getPropertyValue(`--${t}`).trim()};`,
  ).join("");
  const figureVars = document.documentElement.classList.contains("dark")
    ? Object.entries(FIGURE_DARK_TOKENS)
        .map(([name, value]) => `--fig-${name}:${value};`)
        .join("")
    : "";
  return `${FIGURE_FONT_LINK}<style>:root{${vars}${figureVars}}
body{margin:0;padding:14px 16px;font-family:ui-sans-serif,system-ui,sans-serif;color:var(--foreground);background:var(--card);}
@media print{*{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
.katex{max-width:100%;}
.katex-display{max-width:100%;overflow-x:auto;overflow-y:hidden;padding-bottom:2px;}
span:has(>.katex):not(.math):not(.math-display){display:inline-block;max-width:100%;overflow-x:auto;vertical-align:middle;}
.math,.math-display{display:inline-block;max-width:100%;overflow-x:auto;vertical-align:middle;}
.math-display{display:block;}
img,video,canvas{max-width:100%;height:auto;}
svg[viewBox]:not(.lucide){max-width:100%;height:auto;}
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

// Installed first so uncaught errors from generated scripts reach the parent.
function errorScript(id: string) {
  return `<script>window.addEventListener("error",function(e){parent.postMessage({type:"scribe-widget-error",id:${JSON.stringify(id)},message:String((e&&e.message)||"Script error")},"*");});</script>`;
}

function resizeScript(id: string) {
  return `<script>(function(){
  // documentElement.scrollHeight never drops below the frame's own height,
  // so a small figure stayed at the initial size; measure the content instead.
  function contentHeight(){var b=document.body;if(!b)return document.documentElement.scrollHeight;var bottom=0;for(var i=0;i<b.children.length;i++){var el=b.children[i];if(el.tagName==="SCRIPT"||el.tagName==="STYLE")continue;var r=el.getBoundingClientRect();bottom=Math.max(bottom,r.bottom+window.scrollY);}var cs=getComputedStyle(b);return Math.ceil(bottom+(parseFloat(cs.marginBottom)||0)+(parseFloat(cs.paddingBottom)||0));}
  // A figure drawn for a laptop (fixed-width labels, wide tables) is scaled
  // down to the frame instead of spilling past it on a phone.
  var fitting=false;
  // Percentage-positioned labels move with the layout width, so shrink in a few passes.
  function fit(){var b=document.body,d=document.documentElement;if(!b||fitting)return;fitting=true;try{b.style.zoom="";var z=1;for(var i=0;i<8;i++){var over=d.scrollWidth,room=d.clientWidth;if(room<=0||over<=room+1||z<=0.5)break;z=Math.max(0.5,z*room/over);b.style.zoom=String(z);}}finally{fitting=false;}}
  function post(){fit();parent.postMessage({type:"scribe-widget-height",id:${JSON.stringify(id)},height:contentHeight()},"*");}
  if(typeof ResizeObserver!=="undefined"){var ro=new ResizeObserver(post);ro.observe(document.documentElement);if(document.body)ro.observe(document.body);}
  window.addEventListener("load",post);
  setTimeout(post,50);
})();</script>`;
}

interface HtmlWidgetProps {
  html: string;
  title?: string;
  /** Where this widget lives, for render-issue reports to the server. */
  surface?: RenderIssueSurface;
  /** No frame of its own (e.g. a picture inside a multiple-choice option). */
  bare?: boolean;
}

/**
 * Renders LLM-authored self-contained HTML/JS visualizers in a sandboxed
 * iframe (scripts allowed, no same-origin access — the document can't reach
 * cookies, storage, or the parent app). Height auto-fits via postMessage.
 */
export function HtmlWidget({
  html: htmlProp,
  title,
  surface = "widget",
  bare = false,
}: HtmlWidgetProps) {
  const frameId = useId();
  const [height, setHeight] = useState(320);
  // Agent-repaired markup replaces the original until the prop changes.
  const [repaired, setRepaired] = useState<{ of: string; html: string } | null>(
    null,
  );
  const html = repaired?.of === htmlProp ? repaired.html : htmlProp;
  // Keyed by the markup so a new document clears the previous error.
  const [scriptError, setScriptError] = useState<{
    html: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const d = e.data as {
        type?: string;
        id?: string;
        height?: number;
        message?: string;
        kind?: string;
        count?: number;
        sample?: string;
      } | null;
      if (!d || d.id !== frameId) return;
      if (
        d.type === "scribe-widget-height" &&
        typeof d.height === "number" &&
        Number.isFinite(d.height)
      ) {
        setHeight(Math.min(Math.max(Math.ceil(d.height), MIN_HEIGHT), MAX_HEIGHT));
      } else if (d.type === "scribe-widget-error") {
        const message =
          typeof d.message === "string" ? d.message : "Script error";
        setScriptError((prev) =>
          prev && prev.html === html ? prev : { html, message },
        );
        reportRenderIssue({
          surface,
          kind: "script_error",
          detail: message,
          snippet: html,
        });
      } else if (
        d.type === "scribe-widget-quality" &&
        (d.kind === "unrendered_math" || d.kind === "bare_latex")
      ) {
        reportRenderIssue({
          surface,
          kind: d.kind,
          detail: `${d.count ?? 1} element(s): ${typeof d.sample === "string" ? d.sample : ""}`,
          snippet: html,
        });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [frameId, html, surface]);

  const srcDoc = useMemo(
    () =>
      errorScript(frameId) +
      tailwindScript() +
      lucideScript() +
      katexScript(frameId) +
      themeStyle() +
      prerenderFigureMath(html, renderTex) +
      resizeScript(frameId),
    [html, frameId],
  );
  const error = scriptError?.html === html ? scriptError.message : null;

  return (
    <figure className={bare ? "overflow-hidden" : "my-2 overflow-hidden rounded-xl border border-border bg-card animate-fade-up"}>
      <iframe
        title={title ?? "Interactive visualizer"}
        sandbox="allow-scripts"
        srcDoc={srcDoc}
        style={{ height }}
        className="w-full border-0 bg-card"
      />
      {title && (
        <figcaption className="px-3.5 py-2 text-[11px] text-muted-foreground border-t border-border">
          <MathText text={title} />
        </figcaption>
      )}
      {error && (
        <div className="px-2 pb-2">
          <BrokenBlock
            kind="widget"
            source={html}
            error={error}
            onFixed={(fixed) => setRepaired({ of: htmlProp, html: fixed })}
            fallback={null}
          />
        </div>
      )}
    </figure>
  );
}
