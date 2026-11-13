"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, Link2, Loader2, Upload } from "lucide-react";
import { createWorkspace } from "@/lib/api/workspace";
import { analyzeFiles, importYoutube, uploadFiles } from "@/lib/api/materials";
import { createStudySession } from "@/lib/api/study";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toastError } from "@/lib/toast";
import { TourVideo, markAppTourSeen } from "@/components/onboarding/app-tour";

const SUGGESTED = ["Biology HL", "Chemistry SL", "Maths AA", "Economics", "History", "Psychology", "Computer Science", "Physics"];
const UPLOAD_ACCEPT = ".pdf,.pptx,.docx,.txt,.md,.png,.jpg,.jpeg,.mp3,.m4a,.wav";

type Step = "intro" | "subject" | "material" | "building";

/** First run: (optional walkthrough video,) name a subject, drop your notes (or a YouTube link), the first session builds. The cat walks you through. */
export function SubjectOnboarding({ onSkip, firstName, intro = false }: { onSkip: () => void; firstName?: string; intro?: boolean }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>(intro ? "intro" : "subject");
  const [subject, setSubject] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [link, setLink] = useState("");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (intro) markAppTourSeen();
  }, [intro]);

  const addFiles = (list: FileList | File[] | null) => {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)].slice(0, 10));
  };

  const build = async () => {
    const name = subject.trim();
    if (!name || (files.length === 0 && !link.trim())) return;
    setBusy(true);
    setStep("building");
    try {
      setStatus("Making your subject…");
      const workspaceId = await createWorkspace(name);
      if (!workspaceId) throw new Error("Could not create the subject");
      if (files.length) {
        setStatus(`Uploading ${files.length} file${files.length === 1 ? "" : "s"}…`);
        const fileIds = await uploadFiles(workspaceId, files);
        setStatus("Reading your notes…");
        await analyzeFiles(workspaceId, fileIds).catch(() => {});
      }
      if (link.trim()) {
        setStatus("Fetching the video transcript…");
        await importYoutube(workspaceId, link.trim()).catch(() => {});
      }
      setStatus("Building your first session…");
      const session = await createStudySession({
        workspaceId,
        title: `${name} — session 1`,
        depth: "light",
        durationMinutes: 15,
        topics: name,
      });
      router.push(session ? `/workspace/${workspaceId}/session/${session.id}` : `/workspace/${workspaceId}`);
    } catch (e) {
      toastError(e, "Couldn't finish setting up");
      setBusy(false);
      setStep("material");
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-white px-5 py-10">
      <div className={cn("w-full", step === "intro" ? "max-w-[680px]" : "max-w-[460px]")}>
        {step === "intro" && (
          <section>
            <h1 className="text-center text-[24px] font-bold tracking-tight">{firstName ? `Hi ${firstName} — here's how Scribe works` : "Here's how Scribe works"}</h1>
            <p className="mt-1 text-center text-[14px] text-muted-foreground">50 seconds. Then we&apos;ll set up your first subject together.</p>
            <TourVideo autoPlay className="mt-5" />
            <button
              type="button"
              onClick={() => setStep("subject")}
              className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent text-[15px] font-semibold text-white hover:bg-accent-dim"
            >
              Set up my first subject <ArrowRight className="size-4" />
            </button>
            <button type="button" onClick={onSkip} className="mt-4 block w-full text-center text-[13px] font-medium text-faint hover:text-foreground">
              I&apos;ll look around first
            </button>
          </section>
        )}
        <div className={cn("mb-6 flex items-center justify-center gap-1.5", step === "intro" && "hidden")}>
          {(["subject", "material", "building"] as Step[]).map((s, i) => (
            <span
              key={s}
              className={cn(
                "h-1.5 rounded-full transition-all",
                s === step ? "w-8 bg-accent" : i < ["subject", "material", "building"].indexOf(step) ? "w-4 bg-accent/50" : "w-4 bg-muted",
              )}
            />
          ))}
        </div>

        {step === "subject" && (
          <section>
            <Image src="/design/cat2-wave.png" alt="" width={96} height={96} unoptimized className="cat-wiggle mx-auto h-24 w-auto" />
            <h1 className="mt-3 text-center text-[24px] font-bold tracking-tight">
              {firstName ? `Hi ${firstName} — what are you studying?` : "What are you studying?"}
            </h1>
            <p className="mt-1 text-center text-[14px] text-muted-foreground">One subject to start. You can add more later.</p>
            <form
              className="mt-6"
              onSubmit={(e) => {
                e.preventDefault();
                if (subject.trim()) setStep("material");
              }}
            >
              <Input autoFocus value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Chemistry HL" className="h-12 text-[16px]" />
              <div className="mt-3 flex flex-wrap gap-1.5">
                {SUGGESTED.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSubject(s)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-[12.5px] font-semibold",
                      subject === s ? "border-accent bg-accent-soft text-accent" : "border-border text-muted-foreground hover:border-border-strong",
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <button
                type="submit"
                disabled={!subject.trim()}
                className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent text-[15px] font-semibold text-white hover:bg-accent-dim disabled:opacity-50"
              >
                Next <ArrowRight className="size-4" />
              </button>
            </form>
            <button type="button" onClick={onSkip} className="mt-4 block w-full text-center text-[13px] font-medium text-faint hover:text-foreground">
              I&apos;ll look around first
            </button>
          </section>
        )}

        {step === "material" && (
          <section>
            <Image src="/design/cat2-book.png" alt="" width={96} height={96} unoptimized className="cat-bob mx-auto h-24 w-auto" />
            <h1 className="mt-3 text-center text-[24px] font-bold tracking-tight">Drop your {subject.trim()} notes</h1>
            <p className="mt-1 text-center text-[14px] text-muted-foreground">Slides, PDFs, photos of notes or a lecture recording — I&apos;ll turn them into your first session.</p>
            <input ref={fileRef} type="file" multiple accept={UPLOAD_ACCEPT} className="hidden" onChange={(e) => addFiles(e.target.files)} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                addFiles(e.dataTransfer.files);
              }}
              className={cn(
                "mt-6 flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors",
                dragging ? "border-accent bg-accent-soft/60" : "border-border hover:border-accent/60 hover:bg-muted/50",
              )}
            >
              <Upload className="size-6 text-accent" />
              <div className="text-[15px] font-semibold">{files.length ? `${files.length} file${files.length === 1 ? "" : "s"} ready` : "Drop files or click to browse"}</div>
              <div className="text-[12.5px] text-faint">{files.length ? files.map((f) => f.name).join(", ") : "PDF, slides, docs, images, audio · up to 10 files"}</div>
            </button>
            <div className="mt-3 flex items-center gap-2">
              <Link2 className="size-4 shrink-0 text-faint" />
              <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="…or paste a YouTube link" />
            </div>
            <button
              type="button"
              disabled={busy || (files.length === 0 && !link.trim())}
              onClick={() => void build()}
              className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent text-[15px] font-semibold text-white hover:bg-accent-dim disabled:opacity-50"
            >
              Build my first session <ArrowRight className="size-4" />
            </button>
            <button type="button" onClick={() => setStep("subject")} className="mt-4 block w-full text-center text-[13px] font-medium text-faint hover:text-foreground">
              Back
            </button>
          </section>
        )}

        {step === "building" && (
          <section className="text-center">
            <Image src="/design/cat2-think.png" alt="" width={96} height={96} unoptimized className="cat-bob mx-auto h-24 w-auto" />
            <h1 className="mt-3 text-[24px] font-bold tracking-tight">Setting up {subject.trim()}</h1>
            <p className="mt-2 inline-flex items-center gap-2 text-[14px] text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-accent" /> {status}
            </p>
            <p className="mt-6 text-[12.5px] text-faint">Your first session opens as soon as it&apos;s ready — usually under a minute.</p>
          </section>
        )}
      </div>
    </div>
  );
}
