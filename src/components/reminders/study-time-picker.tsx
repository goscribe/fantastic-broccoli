"use client";

import { useId, useState } from "react";
import { Mascot, type MascotPose } from "@/components/rewards/mascot";
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

/**
 * Each preset's picture: the home landscape at that time of day (tiles cut
 * from public/design/hero, the same window in four lightings) with the cat in
 * the foreground. `sky` is the tile's sky colour, shown until it arrives.
 */
const PRESET_META: Record<StudyTimePreset, { key: string; scene: string; sky: string; pose: MascotPose; cat: string }> = {
  morning: { key: "remind.morning", scene: "morning", sky: "#d9e6fb", pose: "wave", cat: "h-[66%]" },
  afterSchool: { key: "remind.afterSchool", scene: "after-school", sky: "#a8dafb", pose: "book", cat: "h-[66%]" },
  evening: { key: "remind.evening", scene: "evening", sky: "#d9719a", pose: "pencil", cat: "h-[66%]" },
  late: { key: "remind.late", scene: "late", sky: "#0b1351", pose: "sleep", cat: "h-[60%]" },
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
          const meta = PRESET_META[p];
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
                "flex flex-col overflow-hidden rounded-2xl border text-left transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
                selected
                  ? "border-accent bg-accent-soft text-foreground shadow-[0_0_0_1px_var(--accent)]"
                  : "border-border bg-card hover:border-accent/50",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "relative block aspect-[9/4] w-full overflow-hidden bg-cover transition-[filter] sm:aspect-[2/1]",
                  // The night sky keeps its moon; the others keep their hills.
                  p === "late" ? "bg-top" : "bg-bottom",
                  selected ? "saturate-[1.1]" : "saturate-[0.8]",
                )}
                style={{ backgroundColor: meta.sky, backgroundImage: `url(/design/reminders/${meta.scene}.webp)` }}
              >
                <Mascot pose={meta.pose} className={cn("absolute bottom-[-3%] left-[7%]", meta.cat)} />
              </span>
              <span className="block min-w-0 px-3.5 py-2 sm:py-2.5">
                <span className="block text-[14.5px] font-semibold leading-5">{t(meta.key)}</span>
                <span className="block text-[12.5px] leading-5 text-muted-foreground">~{formatStudyTime(minute, locale)}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div
        className={cn(
          "mt-2.5 flex min-h-[56px] items-center gap-3 rounded-2xl border py-2 pl-2 pr-3.5 transition-colors",
          custom ? "border-accent bg-accent-soft shadow-[0_0_0_1px_var(--accent)]" : "border-border bg-card",
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
          className="flex flex-1 items-center gap-2.5 text-left focus-visible:outline-none sm:gap-3"
        >
          {/* A calm stretch of sky with the alarm-clock prop. */}
          <span
            aria-hidden
            className={cn(
              "block size-10 shrink-0 sm:w-[60px] rounded-xl bg-[#a8dafb] bg-no-repeat transition-[filter]",
              custom ? "saturate-[1.1]" : "saturate-[0.8]",
            )}
            style={{
              backgroundImage: "url(/design/reminders/clock.webp), url(/design/reminders/sky.webp)",
              backgroundSize: "auto 82%, cover",
              backgroundPosition: "center, center",
            }}
          />
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
