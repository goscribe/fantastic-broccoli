"use client";

import { rpc } from "./study-session";
import { decodePendingTry, encodePendingTry, PENDING_TRY_KEY } from "@/lib/try";

/**
 * Client for the server's `anon` router ("try before signing up"): an
 * anonymous Quick 5 tied to this browser by an httpOnly signed cookie, then
 * claimed into the account at signup. Contracts mirror the router 1:1.
 */

export interface TryQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

export type TrySource = "topic" | "paste" | "pdf";

export interface TryStartInput {
  source: TrySource;
  topic?: string;
  text?: string;
  pdfBase64?: string;
  fileName?: string;
  locale?: string;
  landing?: string;
  captchaToken?: string;
}

export interface TryStarted {
  attemptId: string;
  title: string;
  questions: TryQuestion[];
  triesLeft: number;
}

export interface TryAttempt {
  id: string;
  title: string;
  source: string;
  questions: TryQuestion[];
  answers: (number | null)[];
  correct: number | null;
  total: number;
  finished: boolean;
  expiresAt: Date;
  claimed: { workspaceId: string; sessionId: string } | null;
}

export const startTry = (input: TryStartInput) => rpc<TryStarted>("anon.start", "mutation", input);

export const fetchTry = (attemptId: string) => rpc<TryAttempt>("anon.get", "query", { attemptId });

export const submitTry = (attemptId: string, answers: (number | null)[], finished: boolean) =>
  rpc<{ correct: number; total: number; finished: boolean }>("anon.submit", "mutation", { attemptId, answers, finished });

export const claimTry = (attemptId: string) =>
  rpc<{ workspaceId: string; sessionId: string }>("anon.claim", "mutation", { attemptId });

/** Remembers the latest attempt so a signup from anywhere (header, login) can still claim it. */
export function rememberPendingTry(attemptId: string): void {
  try {
    localStorage.setItem(PENDING_TRY_KEY, encodePendingTry(attemptId));
  } catch {
    /* storage blocked: the redirect after signup still claims it */
  }
}

export function pendingTry(): string | null {
  try {
    return decodePendingTry(localStorage.getItem(PENDING_TRY_KEY));
  } catch {
    return null;
  }
}

export function clearPendingTry(): void {
  try {
    localStorage.removeItem(PENDING_TRY_KEY);
  } catch {
    /* ignore */
  }
}

/** base64 of a file (no data: prefix), for the desktop PDF drop. */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.onload = () => {
      const url = String(reader.result ?? "");
      resolve(url.slice(url.indexOf(",") + 1));
    };
    reader.readAsDataURL(file);
  });
}
