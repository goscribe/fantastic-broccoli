import { NotesFooter, NotesHeader } from "@/components/notes-public/chrome";

/** Public, server-rendered note pages: Scribe's purple brand, no app shell. */
export default function NotesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="design-root app-brand flex min-h-screen flex-col bg-white text-foreground dark:bg-background">
      <NotesHeader />
      <main className="flex-1">{children}</main>
      <NotesFooter />
    </div>
  );
}
