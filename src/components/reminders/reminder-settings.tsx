"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StudyTimePicker } from "@/components/reminders/study-time-picker";
import { remindersApi, REMINDER_PREFS_KEY } from "@/lib/api/reminders";
import { DEFAULT_REMINDER_MINUTE, detectPlatform, formatStudyTime, type Platform } from "@/lib/reminders";
import { currentPushSubscription, disablePush, enablePush } from "@/lib/push-client";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/reminders";

type DeviceState = "loading" | "on" | "off" | "blocked" | "ios-install" | "unsupported";

function deviceState(platform: Platform, subscribed: boolean): DeviceState {
  if (platform.ios && !platform.standalone) return "ios-install";
  if (!platform.pushSupported) return "unsupported";
  if (platform.permission === "denied") return "blocked";
  return subscribed && platform.permission === "granted" ? "on" : "off";
}

/** Settings → Study reminders: when you study, and push on this device. */
export function ReminderSettings() {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const { data: prefs, isError } = useQuery({
    queryKey: REMINDER_PREFS_KEY,
    queryFn: remindersApi.get,
    retry: false,
  });
  const [device, setDevice] = useState<DeviceState>("loading");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let alive = true;
    void currentPushSubscription().then((sub) => {
      if (alive) setDevice(deviceState(detectPlatform(), !!sub));
    });
    return () => {
      alive = false;
    };
  }, []);

  // Older server without the reminders API: nothing to show.
  if (isError) return null;

  const setTime = async (minute: number | null) => {
    try {
      const next = await remindersApi.setStudyTime(minute);
      queryClient.setQueryData(REMINDER_PREFS_KEY, next);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1600);
    } catch {
      // Saving failed: the picker keeps showing the saved value on the next load.
    }
  };

  const minute = prefs?.studyReminderMinute ?? null;
  const pushRow = prefs?.pushAvailable;

  return (
    <section id="reminders" className="mt-8">
      <h2 className="page-h2">{t("remind.settingsTitle")}</h2>
      <p className="mt-0.5 text-[13px] text-muted-foreground">{t("remind.settingsHint")}</p>
      <div className="mt-3 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[13px] font-semibold">{t("remind.timeLabel")}</p>
          <p className={`text-[12px] font-medium text-accent transition-opacity ${saved ? "opacity-100" : "opacity-0"}`} role="status">
            {t("remind.saved")}
          </p>
        </div>
        {prefs ? (
          <>
            <StudyTimePicker key={String(minute)} value={minute} onChange={(m) => void setTime(m)} className="mt-3 max-w-md" />
            <p className="mt-2.5 text-[12.5px] text-muted-foreground">
              {minute === null ? (
                t("remind.defaultTime").replace("{time}", formatStudyTime(DEFAULT_REMINDER_MINUTE, locale))
              ) : (
                <button type="button" className="font-semibold text-accent-dim hover:underline" onClick={() => void setTime(null)}>
                  {t("remind.useDefault")}
                </button>
              )}
            </p>
          </>
        ) : (
          <div className="mt-3 h-[326px] max-w-md sm:h-[408px] animate-pulse rounded-2xl bg-muted" />
        )}

        {pushRow && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-dim">
                {device === "on" ? <Bell className="size-[18px]" /> : <BellOff className="size-[18px]" />}
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold">{t("remind.thisDevice")}</p>
                <p className="text-[12.5px] leading-snug text-muted-foreground">
                  {device === "on"
                    ? t("remind.deviceOn")
                    : device === "blocked"
                      ? t("remind.blocked")
                      : device === "ios-install"
                        ? t("remind.iosNeedsInstall")
                        : device === "unsupported"
                          ? t("remind.unsupported")
                          : t("remind.deviceOff")}
                </p>
              </div>
            </div>
            {(device === "on" || device === "off") && (
              <Button
                size="sm"
                variant={device === "on" ? "outline" : "primary"}
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  if (device === "on") {
                    await disablePush();
                    setDevice("off");
                  } else {
                    const result = await enablePush(prefs?.vapidPublicKey ?? "");
                    if (result === "granted") {
                      setDevice("on");
                      toast.success(t("remind.pushOn"));
                    } else if (result === "denied") {
                      setDevice("blocked");
                    } else {
                      toast(t("remind.pushFailed"));
                    }
                  }
                  void queryClient.invalidateQueries({ queryKey: REMINDER_PREFS_KEY });
                  setBusy(false);
                }}
              >
                {device === "on" ? t("remind.turnOff") : t("remind.turnOn")}
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
