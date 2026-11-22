"use client";

import Image from "next/image";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/study-length";
import { cn } from "@/lib/utils";
import {
  STUDY_LENGTH_CATS,
  STUDY_LENGTH_MAX,
  STUDY_LENGTH_MIN,
  STUDY_LENGTH_STEP,
  STUDY_LENGTH_STAGES,
  clampStudyMinutes,
  colorForMinutes,
  formatStudyLength,
  stageForMinutes,
  studyLengthProgress,
} from "@/lib/study-length";

/**
 * "How long?" as one drag: the track and the number turn from calm teal to
 * red, and the cat goes from sipping tea to drenched in a headband. Depth
 * follows from the minutes (light up to 15, moderate up to 45, deep beyond).
 */
export function StudyLengthSlider({
  value,
  onChange,
  className,
}: {
  value: number;
  onChange: (minutes: number) => void;
  className?: string;
}) {
  const { t } = useI18n();
  const minutes = clampStudyMinutes(value);
  const stage = stageForMinutes(minutes);
  const color = colorForMinutes(minutes);
  const pct = studyLengthProgress(minutes) * 100;
  const label = formatStudyLength(minutes, { min: t("studyLength.min"), h: t("studyLength.hour") });

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className="relative h-[112px] w-[112px] sm:h-[128px] sm:w-[128px]" aria-hidden>
        {/* All four are mounted so dragging never waits on a download; only one shows. */}
        {STUDY_LENGTH_STAGES.map((s) => (
          <Image
            key={s}
            src={STUDY_LENGTH_CATS[s]}
            alt=""
            width={400}
            height={400}
            unoptimized
            priority={s === stage}
            className={cn(
              "absolute inset-0 m-auto h-full w-auto object-contain transition-opacity duration-150",
              s === stage ? "cat-bob opacity-100" : "opacity-0",
            )}
          />
        ))}
      </div>

      <p className="mt-2 text-[28px] font-bold leading-none tabular-nums transition-colors" style={{ color }}>
        {label}
      </p>
      <p className="mt-1 text-[14px] font-medium text-muted-foreground">{t(`studyLength.stage.${stage}`)}</p>

      <input
        type="range"
        min={STUDY_LENGTH_MIN}
        max={STUDY_LENGTH_MAX}
        step={STUDY_LENGTH_STEP}
        value={minutes}
        onChange={(e) => onChange(clampStudyMinutes(Number(e.target.value)))}
        aria-label={t("studyLength.aria")}
        aria-valuetext={`${label}, ${t(`studyLength.stage.${stage}`)}`}
        className="study-length-range mt-4 w-full"
        style={
          {
            "--study-length-color": color,
            "--study-length-fill": `${pct}%`,
          } as React.CSSProperties
        }
      />
      <div className="mt-1.5 flex w-full justify-between text-[12px] font-medium text-muted-foreground">
        <span>{t("studyLength.light")}</span>
        <span>{t("studyLength.deep")}</span>
      </div>
    </div>
  );
}
