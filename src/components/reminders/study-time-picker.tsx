"use client";

import { useId, useState } from "react";
import { Clock, Moon, Sun, Sunset, Backpack } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  STUDY_TIME_PRESETS,
  STUDY_TIME_PRESET_ORDER,
  STUDY_TIME_STEP,
  formatStudyTime,
  minuteToTimeInput,
  presetFor,
  timeInputToMinute,
  type StudyTimePreset,
} from "@/lib/reminders";
import "@/lib/i18n/reminders";

const PRESET_META: Record<StudyTimePreset, { key: string; icon: typeof Sun }> = {
  morning: { key: "remind.morning", icon: Sun },
  afterSchool: { key: "remind.afterSchool", icon: Backpack },
  evening: { key: "remind.evening", icon: Sunset },
  late: { key: "remind.late", icon: Moon },
};

/**
 * "When do you usually study?" — four presets and a custom time (15-minute
 * steps, the comeback job's resolution). Controlled: `value` is minutes after
 * local midnight, null when nothing is picked.
 */
export function StudyTimePicker({
  value,
  onChange,
  className,
}: {
  value: number | null;
  onChange: (minute: number) => void;
  className?: string;
}) {
  const { t, locale } = useI18n();
  const id = useId();
  const preset = presetFor(value);
  const [custom, setCustom] = useState(value !== null && preset === null);
  const customValue = value ?? STUDY_TIME_PRESETS.evening;

  return (
    <div className={className}>
      <div role="radiogroup" aria-label={t("remind.studyTitle")} className="grid grid-cols-2 gap-2.5">
        {STUDY_TIME_PRESET_ORDER.map((p) => {
          const minute = STUDY_TIME_PRESETS[p];
          const selected = !custom && preset === p;
          const Icon = PRESET_META[p].icon;
          return (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => {
                setCustom(false);
                onChange(minute);
              }}
              className={cn(
                "flex min-h-[64px] items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
                selected
                  ? "border-accent bg-accent-soft text-foreground shadow-[inset_0_0_0_1px_var(--accent)]"
                  : "border-border bg-card hover:border-accent/50",
              )}
            >
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-xl",
                  selected ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                <Icon className="size-[18px]" />
              </span>
              <span className="min-w-0">
                <span className="block text-[14.5px] font-semibold leading-5">{t(PRESET_META[p].key)}</span>
                <span className="block text-[12.5px] leading-5 text-muted-foreground">~{formatStudyTime(minute, locale)}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div
        className={cn(
          "mt-2.5 flex min-h-[52px] items-center gap-3 rounded-2xl border px-3.5 py-2 transition-colors",
          custom ? "border-accent bg-accent-soft shadow-[inset_0_0_0_1px_var(--accent)]" : "border-border bg-card",
        )}
      >
        <button
          type="button"
          role="radio"
          aria-checked={custom}
          onClick={() => {
            setCustom(true);
            onChange(customValue);
          }}
          className="flex flex-1 items-center gap-3 text-left focus-visible:outline-none"
        >
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-xl",
              custom ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            <Clock className="size-[18px]" />
          </span>
          <span className="text-[14.5px] font-semibold">{t("remind.custom")}</span>
        </button>
        <label htmlFor={`${id}-time`} className="sr-only">
          {t("remind.custom")}
        </label>
        <input
          id={`${id}-time`}
          type="time"
          step={STUDY_TIME_STEP * 60}
          value={minuteToTimeInput(customValue)}
          onFocus={() => {
            if (!custom) {
              setCustom(true);
              onChange(customValue);
            }
          }}
          onChange={(e) => {
            const m = timeInputToMinute(e.target.value);
            if (m === null) return;
            setCustom(true);
            onChange(m);
          }}
          className="h-10 rounded-xl border border-border bg-background px-2.5 text-[15px] font-semibold tabular-nums outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
      </div>
    </div>
  );
}
