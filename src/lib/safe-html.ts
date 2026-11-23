/**
 * HTML the server made from a student's own Word file (mammoth), cleaned
 * before it is put on the page as a read-only preview: no scripts, frames,
 * forms or event handlers, and links / images only to ordinary addresses.
 * Browser only (DOMParser).
 */
const DROP = "script,style,iframe,object,embed,link,meta,base,form,input,button,textarea,select,svg,math,template,noscript";
const SAFE_URL = /^(?:https?:|mailto:|#|data:image\/(?:png|jpe?g|gif|webp|bmp);)/i;

export function safeHtml(html: string): string {
  if (typeof DOMParser === "undefined") return "";
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  doc.body.querySelectorAll(DROP).forEach((el) => el.remove());
  for (const el of doc.body.querySelectorAll("*")) {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on") || name === "style" || name === "srcdoc" || name === "srcset") el.removeAttribute(attr.name);
      else if ((name === "href" || name === "src" || name === "xlink:href" || name === "action" || name === "formaction") && !SAFE_URL.test(attr.value.trim())) el.removeAttribute(attr.name);
    }
    if (el.tagName === "A") {
      el.setAttribute("rel", "noopener noreferrer nofollow");
      if (!(el.getAttribute("href") ?? "").startsWith("#")) el.setAttribute("target", "_blank");
    }
  }
  return doc.body.innerHTML;
}
