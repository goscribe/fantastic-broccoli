import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/**
 * Open Graph / Twitter card for the public note pages, 1200×630 PNG: the
 * afternoon landscape with the headphones cat on the grass at the right
 * (one pre-drawn picture, og-notes-scene-hp.png), and the words in Nunito on
 * a solid white card at the left so they read at any preview size.
 */
export const OG_SIZE = { width: 1200, height: 630 };

const dataUrl = (type: string) => (b: Buffer) => `data:${type};base64,${b.toString("base64")}`;

let scene: Promise<string> | null = null;
let mark: Promise<string> | null = null;
const sceneDataUrl = () =>
  (scene ??= readFile(join(process.cwd(), "public/brand/og-notes-scene-hp.png"))
    .then(dataUrl("image/png"))
    .catch(() => ""));
const markDataUrl = () =>
  (mark ??= readFile(join(process.cwd(), "public/brand/scribe-hp-logo-512.png"))
    .then(dataUrl("image/png"))
    .catch(() => ""));

type OgFont = { name: string; data: Buffer; weight: 400 | 700 | 800; style: "normal" };
let fonts: Promise<OgFont[]> | null = null;
/** Nunito (the site's face, latin) for the words; Geist, next/og's own default, catches any glyph Nunito's latin set lacks. */
const loadFonts = () =>
  (fonts ??= Promise.all([
    readFile(join(process.cwd(), "src/lib/notes-public/fonts/nunito-latin-700-normal.woff")).then((data): OgFont => ({ name: "Nunito", data, weight: 700, style: "normal" })),
    readFile(join(process.cwd(), "src/lib/notes-public/fonts/nunito-latin-800-normal.woff")).then((data): OgFont => ({ name: "Nunito", data, weight: 800, style: "normal" })),
    readFile(join(process.cwd(), "node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf")).then((data): OgFont => ({ name: "Geist", data, weight: 400, style: "normal" })),
  ]).catch(() => []));

export async function notesOgImage(opts: { eyebrow: string; title: string; subtitle: string }) {
  const [bg, logo, fontList] = await Promise.all([sceneDataUrl(), markDataUrl(), loadFonts()]);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#a8dafb", color: "#16161a", padding: 56, fontFamily: fontList.length ? "Nunito, Geist" : "sans-serif" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain <img>, not next/image */}
        {bg ? <img src={bg} width={1200} height={630} alt="" style={{ position: "absolute", left: 0, top: 0 }} /> : null}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: 680,
            height: "100%",
            padding: "40px 48px",
            background: "#ffffff",
            borderRadius: 36,
            boxShadow: "0 16px 40px rgba(22, 22, 26, 0.28)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", fontSize: 32, fontWeight: 800, color: "#16161a" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain <img>, not next/image */}
            {logo ? <img src={logo} width={84} height={84} alt="" style={{ margin: "-14px 6px -14px -14px" }} /> : null}
            {opts.eyebrow}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: opts.title.length > 48 ? 48 : opts.title.length > 24 ? 58 : 68, fontWeight: 800, lineHeight: 1.08, letterSpacing: -1 }}>{opts.title}</div>
            <div style={{ display: "flex", marginTop: 20, fontSize: 28, fontWeight: 700, color: "#4c4c58" }}>{opts.subtitle}</div>
          </div>
          <div style={{ display: "flex", fontSize: 32, fontWeight: 800, color: "#5b45d6" }}>scribe.study</div>
        </div>
      </div>
    ),
    { ...OG_SIZE, ...(fontList.length ? { fonts: fontList } : {}) },
  );
}
