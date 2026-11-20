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

/** A subject's icon, picked from the course title (flask for Chemistry, …): a plain line icon in ink in a fixed-width column, no tinted tile. */
export function SubjectTile({ title, className, iconClassName }: { title: string; className?: string; iconClassName?: string }) {
  const Icon = ICON[coverKeyForTitle(title)];
  return (
    <span aria-hidden="true" className={cn("grid w-8 shrink-0 place-items-center text-foreground", className)}>
      <Icon className={cn("size-6", iconClassName)} strokeWidth={2} />
    </span>
  );
}
