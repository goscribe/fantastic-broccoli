"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUp,
  Camera,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Dumbbell,
  FileText,
  Headphones,
  Layers,
  Loader2,
  MessageCircle,
  Plus,
  Presentation,
} from "lucide-react";
import { useAuthUser } from "@/lib/api/auth";
import { fetchWorkspaceTree } from "@/lib/api/workspace";
import { fetchStudySessions, fetchActivityCalendar } from "@/lib/api/study";
import { fetchDueReview } from "@/lib/api/study-session";
import { startWorkspaceFromUploads } from "@/lib/start-from-uploads";
import { UPLOAD_ACCEPT } from "@/lib/uploads";
import { onTreeChanged } from "@/lib/tree-events";
import { toastError } from "@/lib/toast";
import { cn, formatRelativeDate } from "@/lib/utils";
import { Donut, Ring, WeekBars } from "@/components/design/charts";
import type { Folder, Material, StudySession, Workspace } from "@/types";
import "@/app/design/design.css";

const ACTIVITY_LABEL: Record<string, string> = {
  mcq: "Quick 5",
  comprehension_check: "Comprehension check",
  flashcard_review: "Flashcards",
  reading: "Reading",
  worksheet: "Worksheet",
  interactive: "Interactive",
  vocab_recall: "Vocab recall",
  cloze: "Cloze",
  explain_aloud: "Explain aloud",
};
const activityLabel = (type: string) => ACTIVITY_LABEL[type.toLowerCase()] ?? type;

const ONE_OFFS = [
  ["Quiz me", Dumbbell, (t: string) => `Quiz me on ${t}`],
  ["Flashcards", Layers, (t: string) => `Make flashcards from ${t}`],
  ["Worksheet", ClipboardList, (t: string) => `Give me a worksheet on ${t}`],
  ["Explain", MessageCircle, (t: string) => `Explain the key ideas in ${t}`],
] as const;

function flatten(folders: Folder[], root: Workspace[]): Workspace[] {
  const all = [...root];
  const walk = (fs: Folder[]) => {
    for (const f of fs) {
      all.push(...f.workspaces);
      if (f.folders) walk(f.folders);
    }
  };
  walk(folders);
  return all;
}

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};

const chatHref = (workspaceId: string, q: string) =>
  `/workspace/${workspaceId}/chat?q=${encodeURIComponent(q)}`;

function MaterialThumb({ m }: { m: Material }) {
  const Icon = { pdf: FileText, note: Camera, slides: Presentation, audio: Headphones }[m.type] ?? FileText;
  return (
    <span className="relative block aspect-[4/3] w-full overflow-hidden rounded-xl bg-muted">
      {m.preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={m.preview} alt="" className="size-full object-cover" />
      ) : (
        <span className="absolute inset-x-6 top-4 rounded-t-md border border-b-0 border-border bg-white px-3 py-3">
          <span className="block h-[5px] w-2/3 rounded bg-neutral-300" />
          <span className="mt-2 block h-[3px] w-full rounded bg-neutral-200" />
          <span className="mt-1 block h-[3px] w-5/6 rounded bg-neutral-200" />
          <span className="mt-1 block h-[3px] w-full rounded bg-neutral-200" />
          <span className="mt-2 block h-8 w-1/2 rounded-[3px] bg-accent-soft" />
        </span>
      )}
      <span className="absolute bottom-2 left-2 grid size-7 place-items-center rounded-lg bg-accent text-white shadow">
        <Icon className="size-3.5" />
      </span>
    </span>
  );
}

function PaperStack() {
  return (
    <span className="relative block h-14 w-14 shrink-0">
      <span className="absolute left-4 top-1.5 h-10 w-8 rotate-[8deg] rounded-[3px] border border-border bg-white" />
      <span className="absolute left-2.5 top-2 h-10 w-8 rotate-[-4deg] rounded-[3px] border border-border bg-white px-1 py-1.5">
        <span className="block h-[3px] w-5 rounded bg-neutral-300" />
        <span className="mt-1 block h-[2px] w-4 rounded bg-neutral-200" />
        <span className="mt-0.5 block h-[2px] w-5 rounded bg-neutral-200" />
        <span className="mt-1 block h-2.5 w-3 rounded-[2px] bg-neutral-200" />
      </span>
    </span>
  );
}

function sessionProgress(s: StudySession) {
  const total = s.activities.length;
  const done = s.activities.filter((a) => a.status === "completed" || a.status === "skipped").length;
  const next = s.activities.find((a) => a.status !== "completed" && a.status !== "skipped");
  return { total, done, next, pct: total ? done / total : s.progress / 100 };
}

export function LearnHome() {
  const router = useRouter();
  const { user } = useAuthUser();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [due, setDue] = useState<number | null>(null);
  const [days, setDays] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = () =>
      fetchWorkspaceTree()
        .then(async (tree) => {
          const ws = flatten(tree.folders, tree.rootWorkspaces);
          setWorkspaces(ws);
          const lists = await Promise.all(ws.map((w) => fetchStudySessions(w.id).catch(() => [] as StudySession[])));
          setSessions(
            lists
              .flat()
              .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
          );
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    load();
    fetchDueReview().then((r) => setDue(r.total)).catch(() => setDue(0));
    fetchActivityCalendar()
      .then((points) => {
        const byDate = new Map(points.map((p) => [p.date.slice(0, 10), p.count]));
        const out: number[] = [];
        const d = new Date();
        d.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1)); // Monday
        for (let i = 0; i < 7; i++) {
          out.push(byDate.get(d.toISOString().slice(0, 10)) ?? 0);
          d.setDate(d.getDate() + 1);
        }
        setDays(out);
      })
      .catch(() => setDays([]));
    return onTreeChanged(load);
  }, []);

  const wsById = useMemo(() => new Map(workspaces.map((w) => [w.id, w])), [workspaces]);
  const materials = useMemo(
    () =>
      workspaces
        .flatMap((w) => w.materials.map((m) => ({ m, w })))
        .sort((a, b) => new Date(b.m.updatedAt).getTime() - new Date(a.m.updatedAt).getTime()),
    [workspaces],
  );
  const shown = expanded ? materials : materials.slice(0, 3);
  const recent = sessions.slice(0, 6);
  const suggested = sessions.find((s) => s.status === "active" && !s.generating);
  const todayIdx = (new Date().getDay() + 6) % 7;
  const streak = useMemo(() => {
    let n = 0;
    for (let i = todayIdx; i >= 0; i--) {
      if ((days[i] ?? 0) > 0) n++;
      else if (i !== todayIdx) break;
    }
    return n;
  }, [days, todayIdx]);
  const defaultWorkspace = suggested ? wsById.get(suggested.workspaceId) : workspaces[0];

  const ask = (q: string) => {
    if (!defaultWorkspace || !q.trim()) return;
    router.push(chatHref(defaultWorkspace.id, q.trim()));
  };

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const { workspaceId, session } = await startWorkspaceFromUploads(Array.from(files));
      router.push(session ? `/workspace/${workspaceId}/session/${session.id}` : `/workspace/${workspaceId}`);
    } catch (e) {
      toastError(e, "Upload failed");
      setUploading(false);
    }
  };

  const firstName = user?.name?.split(" ")[0];

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-6 pb-12 pt-6 lg:flex-row">
      <input ref={fileRef} type="file" multiple accept={UPLOAD_ACCEPT} className="hidden" onChange={(e) => void onFiles(e.target.files)} />
      <div className="flex min-w-0 flex-1 flex-col gap-[18px]">
        <div className="flex items-end justify-between">
          <h1 className="text-[26px] font-bold">
            {greeting()}
            {firstName ? `, ${firstName}` : ""}
          </h1>
          {sessions.length > 0 && <span className="text-[13px] text-faint">{sessions.length} study sessions</span>}
        </div>

        <form
          className="rounded-[18px] border border-border p-3.5"
          onSubmit={(e) => {
            e.preventDefault();
            ask(prompt);
          }}
        >
          <div className="flex items-center gap-3">
            <Image src="/design/cat2-wave.png" alt="" width={40} height={40} unoptimized className="cat-wiggle h-10 w-auto" />
            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={defaultWorkspace ? "What do you want to practise?" : "Add a material first, then ask for anything"}
              disabled={!defaultWorkspace}
              className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint"
            />
            <button type="submit" disabled={!defaultWorkspace || !prompt.trim()} className="grid size-9 place-items-center rounded-[10px] bg-accent text-white disabled:opacity-40">
              <ArrowUp className="size-4" />
            </button>
          </div>
          {defaultWorkspace && (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {[`Quiz me on ${defaultWorkspace.title}`, `Flashcards for ${defaultWorkspace.title}`, "Explain what I got wrong last time", "Mock paper, section A"].map((c) => (
                <button key={c} type="button" onClick={() => ask(c)} className="whitespace-nowrap rounded-full border border-border px-3 py-1.5 text-[12.5px] font-semibold hover:bg-muted">
                  {c}
                </button>
              ))}
            </div>
          )}
        </form>

        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-semibold">
            Your materials <span className="font-medium text-faint">· {materials.length}</span>
          </h2>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="inline-flex h-8 items-center gap-1.5 rounded-[9px] bg-muted px-3 text-[12.5px] font-semibold hover:bg-accent-soft">
              {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
              Add material
            </button>
            {materials.length > 3 && (
              <button type="button" onClick={() => setExpanded((v) => !v)} className="inline-flex items-center gap-1 text-[13px] font-semibold text-accent hover:underline">
                {expanded ? (
                  <>
                    Show less <ChevronUp className="size-4" />
                  </>
                ) : (
                  <>
                    Show all {materials.length} <ChevronDown className="size-4" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 md:grid-cols-3">
          {loading && materials.length === 0 && [0, 1, 2].map((i) => <div key={i} className="h-[232px] animate-pulse rounded-2xl bg-muted" />)}
          {shown.map(({ m, w }) => (
            <div key={m.id} className="flex flex-col rounded-2xl border border-border bg-card p-3">
              <Link href={`/workspace/${w.id}/materials`}>
                <MaterialThumb m={m} />
              </Link>
              <div className="mt-3 truncate px-0.5 text-[14.5px] font-semibold">{m.title}</div>
              <div className="truncate px-0.5 text-[12px] text-faint">
                {w.title} · {formatRelativeDate(m.updatedAt)}
              </div>
              <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                {ONE_OFFS.map(([label, Icon, q]) => (
                  <Link key={label} href={chatHref(w.id, q(m.title))} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-[9px] bg-muted px-2 text-[12px] font-semibold hover:bg-accent-soft hover:text-accent">
                    <Icon className="size-3.5" />
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
          {(expanded || (!loading && materials.length < 3)) && (
            <button type="button" onClick={() => fileRef.current?.click()} className="flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border p-4 text-center hover:border-accent/50 hover:bg-accent-soft/40">
              <Image src="/design/cat2-sleep.png" alt="" width={64} height={64} unoptimized className="cat-bob h-16 w-auto" />
              <div>
                <div className="text-[14.5px] font-semibold">Add material</div>
                <div className="mt-0.5 text-[12px] text-faint">PDF · slides · photos of notes</div>
              </div>
            </button>
          )}
        </div>

        <div className="flex items-baseline justify-between">
          <h2 className="text-[16px] font-semibold">Recent study sessions</h2>
        </div>
        <div className="divide-y divide-border rounded-2xl border border-border bg-card">
          {!loading && recent.length === 0 && (
            <div className="flex items-center gap-4 px-5 py-6 text-[14px] text-muted-foreground">
              <Image src="/design/cat2-book.png" alt="" width={56} height={56} unoptimized className="cat-bob h-14 w-auto" />
              Your first session shows up here once you add a material.
            </div>
          )}
          {recent.map((s) => {
            const { total, done, next, pct } = sessionProgress(s);
            const w = wsById.get(s.workspaceId);
            const finished = s.status === "completed";
            const r = 27;
            return (
              <div key={s.id} className="flex items-center gap-3.5 px-4 py-3">
                <span className="relative grid size-[60px] shrink-0 place-items-center">
                  <svg viewBox="0 0 60 60" className="absolute inset-0 -rotate-90">
                    <circle cx="30" cy="30" r={r} fill="none" stroke="var(--color-muted)" strokeWidth="3.5" />
                    <circle cx="30" cy="30" r={r} fill="none" stroke={finished ? "#10b981" : "var(--color-accent)"} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${pct * 2 * Math.PI * r} ${2 * Math.PI * r}`} />
                  </svg>
                  <span className="scale-[.72]">
                    <PaperStack />
                  </span>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[14px] font-semibold">{s.title}</span>
                    {finished && <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">Done</span>}
                    {s.generating && <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[11px] font-semibold text-accent">Building…</span>}
                  </div>
                  <div className="truncate text-[12px] text-faint">
                    {w?.title ?? "Workspace"} · {s.durationMinutes} min · {s.depth}
                    {next && !finished ? ` · next: ${activityLabel(next.type)}` : total ? ` · ${done}/${total} activities` : ""}
                  </div>
                </div>
                <div className="hidden w-20 shrink-0 text-right text-[12px] text-faint sm:block">{formatRelativeDate(s.updatedAt)}</div>
                <Link href={`/workspace/${s.workspaceId}/session/${s.id}`} className={cn("inline-flex h-8 w-[108px] shrink-0 items-center justify-center rounded-[9px] text-[12.5px] font-semibold", s.status === "active" && done > 0 ? "bg-accent text-white" : "border border-border hover:bg-muted")}>
                  {finished ? "View debrief" : done > 0 ? "Continue" : "Start"}
                </Link>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex w-full shrink-0 flex-col gap-3.5 lg:w-[300px]">
        {suggested && (() => {
          const { done, total, next } = sessionProgress(suggested);
          return (
            <div className="relative overflow-hidden rounded-2xl p-[18px]" style={{ background: "var(--accent-soft)" }}>
              <Image src="/design/cat2-book.png" alt="" width={72} height={72} unoptimized className="cat-peek absolute right-2.5 top-2 h-[72px] w-auto" />
              <div className="flex items-center gap-2">
                <Ring pct={total ? done / total : 0} size={28} stroke={12} color="var(--accent)" />
                <span className="text-[11px] font-semibold text-accent">
                  Suggested next · {done} of {total} done
                </span>
              </div>
              <div className="mt-2 pr-16 text-[16px] font-bold leading-tight">{next ? `${activityLabel(next.type)} · ${next.title}` : suggested.title}</div>
              <div className="mt-1 text-[12.5px] text-muted-foreground">
                {next ? `${next.estimatedMinutes} min · ` : ""}
                {wsById.get(suggested.workspaceId)?.title}
              </div>
              <div className="mt-3.5 flex gap-2">
                <Link href={`/workspace/${suggested.workspaceId}/session/${suggested.id}`} className="inline-flex h-9 items-center rounded-xl bg-accent px-4 text-[13.5px] font-semibold text-white">
                  {done > 0 ? "Continue" : "Start"}
                </Link>
              </div>
            </div>
          );
        })()}
        <div className="rounded-2xl border border-border p-[18px]">
          <div className="flex items-baseline justify-between">
            <span className="text-[16px] font-semibold">Due for review</span>
          </div>
          <div className="mt-3 flex items-center gap-4">
            <Donut parts={due ? [[1, "var(--accent)"]] : [[1, "var(--border)"]]}>
              <span className="text-[20px] font-bold leading-none">{due ?? "–"}</span>
              <br />
              <span className="text-[11px] font-semibold text-faint">due</span>
            </Donut>
            <div className="text-[13px] text-muted-foreground">{due ? `${due} flashcards are due today. About ${Math.max(1, Math.round(due / 3))} min.` : "Nothing due right now — nice."}</div>
          </div>
          <Link href="/flashcards/review" className={cn("mt-3.5 inline-flex h-10 w-full items-center justify-center rounded-xl text-[14px] font-semibold", due ? "bg-accent text-white" : "bg-muted")}>
            {due ? "Review now" : "Browse flashcards"}
          </Link>
        </div>
        <div className="rounded-2xl border border-border p-[18px]">
          <div className="flex items-baseline justify-between">
            <span className="text-[16px] font-semibold">This week</span>
            <span className="text-[12px] text-faint">
              {days.reduce((a, b) => a + b, 0)} activities{streak > 1 ? <> · <b className="text-accent">{streak}-day streak</b></> : null}
            </span>
          </div>
          <div className="mt-3.5">
            <WeekBars mins={days.length ? days : [0, 0, 0, 0, 0, 0, 0]} goal={3} today={todayIdx} accent="var(--accent)" />
          </div>
        </div>
      </div>
    </div>
  );
}
