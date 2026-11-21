/** A streak freeze Scribe applied by itself (`streak.get` → `freezeSave`). */
export interface FreezeSave {
  at: string;
  days: string[];
  streak: number;
  bought: number;
  pointsSpent: number;
}

/** The one line to show for a freeze save, or null (exported for tests). */
export function freezeSaveLine(save: FreezeSave | null | undefined, t: (key: string) => string): string | null {
  if (!save || !save.days?.length || save.streak <= 0) return null;
  const key = save.bought > 0 && save.pointsSpent > 0 ? "purpose.freezeSavedBought" : "purpose.freezeSaved";
  return t(key).replace("{n}", String(save.streak)).replace("{p}", String(save.pointsSpent));
}
