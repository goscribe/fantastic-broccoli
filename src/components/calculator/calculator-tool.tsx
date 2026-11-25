"use client";

import { useCallback, useEffect, useId, useRef, useState, type RefObject } from "react";
import dynamic from "next/dynamic";
import { Calculator } from "lucide-react";
import { calculatorPlacement } from "@/lib/calculator/access";
import { answerTargetOf, defaultAnswerTarget, insertIntoTarget } from "@/lib/calculator/insert";
import { track } from "@/lib/funnel";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/calculator";
import type { SubjectFamily } from "@/lib/subject-family";
import { cn } from "@/lib/utils";

/** The calculator itself: its own chunk, fetched the first time it is opened. */
const CalculatorPanel = dynamic(() => import("./calculator-panel"), { ssr: false });

const NOTE_MS = 4000;

/**
 * The calculator's way in: a "Calculator" button for subjects that use one
 * every day, a "Tools" menu holding it for the rest, and Alt+C everywhere.
 * On a non-calculator paper the button stays where it is but is off, and
 * says why. This file is all a page pays for until the calculator is opened.
 *
 * `scope` is where the page's answer boxes are: "Insert" writes the result
 * into the one the student was last in (or the first empty one).
 */
export function CalculatorTool({
  family,
  blocked = false,
  workspaceId,
  scope,
  look = "icon",
  className,
}: {
  family: SubjectFamily | null | undefined;
  /** The work on screen is a non-calculator paper. */
  blocked?: boolean;
  workspaceId?: string;
  scope?: RefObject<HTMLElement | null>;
  /** "icon": the session's top bar, whose other buttons are icons. "text": toolbars made of words. */
  look?: "icon" | "text";
  className?: string;
}) {
  const { t } = useI18n();
  const placement = calculatorPlacement(family);
  const [wanted, setWanted] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [menu, setMenu] = useState(false);
  const [note, setNote] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const wrap = useRef<HTMLSpanElement>(null);
  const lastTarget = useRef<HTMLElement | null>(null);
  const noteId = useId();
  const menuId = useId();
  // A non-calculator paper closes the calculator without forgetting that it was open.
  const open = wanted && !blocked;

  const openNow = useCallback(() => {
    setMenu(false);
    if (blocked) {
      setNote(true);
      return;
    }
    setLoaded(true);
    setWanted(true);
    track("calculator.opened", { family: family ?? "general" }, workspaceId);
  }, [blocked, family, workspaceId]);

  const close = useCallback(() => {
    setWanted(false);
    button.current?.focus();
  }, []);

  useEffect(() => {
    if (!note) return;
    const id = window.setTimeout(() => setNote(false), NOTE_MS);
    return () => window.clearTimeout(id);
  }, [note]);

  // Alt+C from anywhere on the page, answer boxes included (matched by key position: on a Mac, ⌥C types "ç").
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.code !== "KeyC") return;
      e.preventDefault();
      if (open) close();
      else openNow();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close, openNow]);

  // Remember the answer box the student was in: opening the calculator takes focus away from it.
  useEffect(() => {
    const onFocus = (e: FocusEvent) => {
      const target = answerTargetOf(e.target as Element | null, scope ? scope.current : null);
      if (target) lastTarget.current = target;
    };
    document.addEventListener("focusin", onFocus);
    return () => document.removeEventListener("focusin", onFocus);
  }, [scope]);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setMenu(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMenu(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const findTarget = useCallback((): HTMLElement | null => {
    const root = scope ? scope.current : null;
    if (!root) return null;
    const last = lastTarget.current;
    if (last && last.isConnected && root.contains(last)) return last;
    return defaultAnswerTarget(root);
  }, [scope]);

  const insert = useCallback(
    (text: string): boolean => {
      const target = findTarget();
      return target ? insertIntoTarget(target, text) : false;
    },
    [findTarget],
  );

  const direct = placement === "toolbar";
  const label = direct ? t("calc.title") : t("calc.tools");
  const hint = blocked && direct ? t("calc.nonCalculator") : direct ? `${t("calc.title")} (${t("calc.shortcut")})` : t("calc.tools");
  const itemOff = blocked;

  return (
    <span ref={wrap} className={cn("relative shrink-0", className)} data-calculator-ignore>
      <button
        ref={button}
        type="button"
        onClick={() => {
          if (!direct) setMenu((v) => !v);
          else if (open) close();
          else openNow();
        }}
        title={hint}
        aria-label={look === "icon" ? label : undefined}
        aria-pressed={direct ? open : undefined}
        aria-haspopup={direct ? undefined : "menu"}
        aria-expanded={direct ? undefined : menu}
        aria-controls={direct ? undefined : menu ? menuId : undefined}
        // Off, but still focusable and tappable: the tap is how the student finds out why.
        aria-disabled={direct && blocked ? true : undefined}
        aria-describedby={direct && blocked ? noteId : undefined}
        data-calculator-trigger
        className={cn(
          look === "icon"
            ? "flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-3 text-small font-bold hover:bg-muted hover:text-foreground"
            : "h-11 whitespace-nowrap rounded-[10px] px-2.5 text-small font-bold hover:bg-muted hover:text-foreground",
          open ? "bg-muted text-foreground" : "text-muted-foreground",
          direct && blocked && "opacity-50",
        )}
      >
        {look === "icon" && direct && <Calculator className="size-4 shrink-0" aria-hidden />}
        {/* The top bar is icons on a phone; from sm up there is room for the word too. */}
        <span className={cn(look === "icon" && direct && "max-sm:hidden")} aria-hidden={look === "icon" ? true : undefined}>
          {label}
        </span>
      </button>

      {direct && blocked && (
        <span id={noteId} className="sr-only">
          {t("calc.nonCalculator")}
        </span>
      )}
      {note && (
        <span
          role="status"
          className="absolute right-0 top-full z-40 mt-1.5 whitespace-nowrap rounded-xl border border-border bg-white px-3 py-2 text-small font-semibold text-foreground shadow-[0_12px_32px_-12px_rgba(0,0,0,0.25)]"
        >
          {t("calc.nonCalculator")}
        </span>
      )}

      {menu && (
        <div id={menuId} role="menu" aria-label={t("calc.tools")} className="absolute right-0 top-full z-40 mt-1.5 w-[220px] rounded-xl border border-border bg-white p-1.5 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.25)]">
          <button
            type="button"
            role="menuitem"
            autoFocus
            aria-disabled={itemOff || undefined}
            onClick={() => {
              if (itemOff) return;
              if (open) {
                setMenu(false);
                close();
              } else openNow();
            }}
            className={cn("flex min-h-11 w-full flex-col justify-center rounded-lg px-3 py-1.5 text-left text-ui font-bold hover:bg-muted", itemOff && "cursor-default hover:bg-transparent")}
          >
            <span className={cn("flex w-full items-center justify-between gap-3", itemOff && "opacity-50")}>
              {t("calc.title")}
              <span className="text-caption font-semibold text-muted-foreground">{t("calc.shortcut")}</span>
            </span>
            {itemOff && <span className="text-small font-semibold text-muted-foreground">{t("calc.nonCalculator")}</span>}
          </button>
        </div>
      )}

      {loaded && <CalculatorPanel open={open} onClose={close} findTarget={findTarget} insert={insert} />}
    </span>
  );
}
