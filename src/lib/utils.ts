import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Folder } from "@/types";

export function countWorkspaces(folder: Folder): number {
  return (
    folder.workspaces.length +
    (folder.folders?.reduce((sum, f) => sum + countWorkspaces(f), 0) ?? 0)
  );
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function formatRelativeDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const ahead = Math.abs(diffDays);
    if (ahead < 7) return `in ${ahead}d`;
    if (ahead < 30) return `in ${Math.ceil(ahead / 7)}w`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function progressPercent(completed: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}
