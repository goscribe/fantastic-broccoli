import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/** Open Graph / Twitter card for the public note pages: purple, title, cat. 1200×630 PNG. */
export const OG_SIZE = { width: 1200, height: 630 };

let cat: Promise<string> | null = null;
const catDataUrl = () =>
  (cat ??= readFile(join(process.cwd(), "public/design/cat3-book.png"))
    .then((b) => `data:image/png;base64,${b.toString("base64")}`)
    .catch(() => ""));

export async function notesOgImage(opts: { eyebrow: string; title: string; subtitle: string }) {
  const src = await catDataUrl();
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#6952E0", color: "white", padding: "64px 72px", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 700, opacity: 0.85 }}>{opts.eyebrow}</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: opts.title.length > 34 ? 64 : 80, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1 }}>{opts.title}</div>
            <div style={{ display: "flex", marginTop: 24, fontSize: 34, opacity: 0.92 }}>{opts.subtitle}</div>
          </div>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 800 }}>scribe.study</div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain <img>, not next/image */}
        {src ? <img src={src} width={300} height={331} alt="" style={{ alignSelf: "flex-end" }} /> : null}
      </div>
    ),
    OG_SIZE,
  );
}
