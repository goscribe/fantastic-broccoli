import "./notes-look.css";
import { NotesFooter, NotesHeader } from "@/components/notes-public/chrome";

// Tailwind's preflight hides [hidden] with !important inside @layer base; an important rule in an
// earlier layer (theme) is the one that outranks it.
const NO_SCRIPT_CSS = `template[id^="B:"] + main { display: none !important; } @layer theme { div[hidden]#S\\:0, div[hidden]:has(> .notes-look) { display: block !important; } }`;

/** Public, server-rendered note pages: Scribe's purple brand on the app's soft off-white page, no app shell (look: notes-look.css). */
export default function NotesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="design-root app-brand notes-look flex min-h-screen flex-col text-foreground">
      {/*
        The app's root loading.tsx makes Next stream this page into a hidden
        block that a script swaps in. With JavaScript off that swap never
        runs, so show the block (and drop the skeleton) with plain CSS.
      */}
      <noscript>
        <style>{NO_SCRIPT_CSS}</style>
      </noscript>
      <NotesHeader />
      <main className="flex-1">{children}</main>
      <NotesFooter />
    </div>
  );
}
