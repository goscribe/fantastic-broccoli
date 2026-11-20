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

/** A subject's icon tile: one lavender tile, the icon picked from the subject's name (flask for Chemistry, …). */
export function SubjectIcon({ title, className }: { title: string; className?: string }) {
  const Icon = ICON[coverKeyForTitle(title)];
  return (
    <span aria-hidden className={cn("grid size-12 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent", className)}>
      <Icon className="size-6" strokeWidth={2.25} />
    </span>
  );
}
