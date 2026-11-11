import Image from "next/image";
import Link from "next/link";
import { Bell, BookOpen, Calendar, ChartColumn, Dumbbell, Ellipsis, House, MessageCircle, Plus, Search, Settings, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { FlameIcon } from "./charts";

const NAV = [
  { href: "/design/learn", label: "Learn", icon: House },
  { href: "/design/question", label: "Practice", icon: Dumbbell },
  { href: "#", label: "Copilot", icon: MessageCircle },
  { href: "#", label: "Planner", icon: Calendar, badge: "New" },
  { href: "#", label: "Progress", icon: ChartColumn },
];
const COURSES = [
  { name: "IB Bio HL", color: "#7c3aed", meta: "Topic 3", on: true },
  { name: "Chem HL", color: "#0ea5e9", meta: "Topic 1" },
  { name: "Maths AA", color: "#f59e0b", meta: "Topic 5" },
];

export function Sidebar({ active = "Learn" }: { active?: string }) {
  return (
    <aside className="flex h-full w-[232px] shrink-0 flex-col border-r border-border bg-white px-3 py-5">
      <Link href="/design" className="mb-5 flex items-center gap-2.5 px-2">
        <Image src="/logo.png" alt="Scribe" width={28} height={28} />
        <span className="text-[17px] font-bold tracking-tight">Scribe</span>
      </Link>
      <nav className="flex flex-col gap-0.5">
        {NAV.map(({ href, label, icon: Icon, badge }) => (
          <Link key={label} href={href} className={cn("flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] font-medium text-foreground/80 hover:bg-muted", label === active && "bg-muted font-semibold text-foreground")}>
            <Icon className="size-[18px]" strokeWidth={label === active ? 2.2 : 1.8} />
            {label}
            {badge && <span className="ml-auto rounded-md bg-blue-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">{badge}</span>}
          </Link>
        ))}
      </nav>
      <div className="mt-6 px-3 text-[11px] font-semibold text-faint">My courses</div>
      <div className="mt-1.5 flex flex-col gap-0.5">
        {COURSES.map((c) => (
          <button key={c.name} className={cn("flex h-9 items-center gap-3 rounded-xl px-3 text-[13.5px] font-medium hover:bg-muted", c.on && "bg-accent-soft/70 text-accent-dim")}>
            <span className="size-2.5 rounded-full" style={{ background: c.color }} />
            <span className="truncate">{c.name}</span>
            <span className="ml-auto text-[11px] font-medium text-faint">{c.meta}</span>
          </button>
        ))}
        <button className="flex h-9 items-center gap-3 rounded-xl px-3 text-[13.5px] font-medium text-accent hover:bg-muted"><Plus className="size-4" />Add course</button>
      </div>
      <div className="mt-auto flex flex-col gap-0.5">
        <button className="flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] font-medium text-foreground/80 hover:bg-muted"><Ellipsis className="size-[18px]" />More</button>
        <button className="flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] font-medium text-foreground/80 hover:bg-muted"><Settings className="size-[18px]" />Settings</button>
      </div>
    </aside>
  );
}

export function TopBar() {
  return (
    <header className="flex h-[72px] items-center gap-3 px-8">
      <label className="flex h-10 w-[300px] items-center gap-2.5 rounded-xl bg-muted px-3.5 text-[13.5px] text-faint"><Search className="size-4" />Search notes, sessions, cards…</label>
      <div className="ml-auto flex items-center gap-2.5">
        <button className="grid size-10 place-items-center rounded-xl text-foreground/60 hover:bg-muted"><Bell className="size-[18px]" /></button>
        <span className="flex h-10 items-center gap-1.5 rounded-xl border border-border bg-white px-3 text-[14px] font-semibold"><FlameIcon size={22} />12</span>
        <span className="flex h-10 items-center gap-1.5 rounded-xl border border-border bg-white px-3 text-[14px] font-semibold"><Sparkles className="size-[18px] text-accent" fill="currentColor" />1,240<span className="font-medium text-faint">XP</span></span>
        <span className="size-10 rounded-full bg-accent-soft" />
      </div>
    </header>
  );
}

export function AppFrame({ active, children }: { active?: string; children: React.ReactNode }) {
  return (
    <div className="flex h-dvh min-h-[800px] overflow-hidden">
      <Sidebar active={active} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="min-h-0 flex-1 overflow-auto px-8 pb-8">{children}</main>
      </div>
    </div>
  );
}

export { BookOpen };
