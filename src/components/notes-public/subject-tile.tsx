import { Atom, BookOpen, Brain, Cpu, Dna, FlaskConical, Globe, GraduationCap, Landmark, Languages, Leaf, Music, Palette, Scale, Sigma, TrendingUp, type LucideIcon } from "lucide-react";
import { coverKeyForTitle, type CoverKey } from "@/lib/subject-cover";
import { cn } from "@/lib/utils";

const ICON: Record<CoverKey, LucideIcon> = {
  math: Sigma,
  physics: Atom,
  chemistry: FlaskConical,
  biology: Dna,
  computing: Cpu,
  economics: TrendingUp,
  history: Landmark,
  geography: Globe,
  literature: BookOpen,
  languages: Languages,
  philosophy: Scale,
  psychology: Brain,
  art: Palette,
  music: Music,
  environment: Leaf,
  general: GraduationCap,
};

/** A subject's icon tile, picked from the course title (flask for Chemistry, …). `solid` is the purple one. */
export function SubjectTile({ title, solid = false, className, iconClassName }: { title: string; solid?: boolean; className?: string; iconClassName?: string }) {
  const Icon = ICON[coverKeyForTitle(title)];
  return (
    <span aria-hidden="true" className={cn("grid size-12 shrink-0 place-items-center rounded-2xl", solid ? "bg-accent text-white shadow-[0_3px_0_0_var(--accent-edge)]" : "bg-accent-soft text-accent", className)}>
      <Icon className={cn("size-6", iconClassName)} strokeWidth={2.25} />
    </span>
  );
}
