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

/** A subject's icon, picked from its name (flask for Chemistry, …): a plain line icon in ink, in a fixed-width column so titles line up. No tinted tile. */
export function SubjectIcon({ title, className }: { title: string; className?: string }) {
  const Icon = ICON[coverKeyForTitle(title)];
  return (
    <span aria-hidden className={cn("grid w-8 shrink-0 place-items-center text-foreground", className)}>
      <Icon className="size-6" strokeWidth={2} />
    </span>
  );
}
