"use client";

import { useNewUi } from "@/lib/new-ui";
import { InteractiveContent } from "@/types";
import { InteractiveWidget, WidgetId, widgetRegistry } from "@/components/interactive";
import { HtmlWidget } from "@/components/interactive/html-widget";
import { MathText } from "@/components/ui/markdown-text";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/session";
import { ArrowRight } from "lucide-react";
import { PlayActions, PlayPrimary } from "@/components/session/play-ui";

interface InteractiveActivityProps {
  content: InteractiveContent;
  onComplete: () => void;
}

const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

/** Normalise "Ohm's Law", "ohms_law", "ohms-law" → a registry id when one matches. */
function resolveWidgetId(componentType: string): WidgetId | undefined {
  if (componentType in widgetRegistry) return componentType as WidgetId;
  const slug = componentType
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (slug in widgetRegistry) return slug as WidgetId;
  return (Object.keys(widgetRegistry) as WidgetId[]).find(
    (id) => slug.replace(/-/g, "") === id.replace(/-/g, ""),
  );
}

export function InteractiveActivity({ content, onComplete }: InteractiveActivityProps) {
  const { t } = useI18n();
  const newUi = useNewUi();
  const { componentType, config } = content;

  const title = text(config.title);
  const prompt = text(config.prompt) ?? text(config.instructions) ?? text(config.description);
  const html = text(config.html);
  const widgetId =
    resolveWidgetId(componentType) ??
    (text(config.widget) ? resolveWidgetId(String(config.widget)) : undefined);

  const body = widgetId ? (
    <InteractiveWidget id={widgetId} />
  ) : html ? (
    <HtmlWidget html={html} title={title} />
  ) : null;

  if (!body) {
    return (
      <Card className="py-6 text-center text-ui text-muted-foreground">
        <p className="mb-4">{t("session.activityUnavailable")}</p>
        <Button onClick={onComplete}>
          {t("session.continue")}
          <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      </Card>
    );
  }

  if (newUi) {
    return (
      <div className="space-y-5">
        <div>
          <p data-scroll-line className="text-small font-semibold text-muted-foreground">{title ?? t("session.interactiveTitle")}</p>
          <p className="life-rise mt-2 text-[20px] font-extrabold leading-[1.3] text-foreground sm:text-[22px]">
            {prompt ? <MathText text={prompt} /> : t("session.interactiveHint")}
          </p>
        </div>
        {/* The widget brings its own surface; nothing is wrapped around it. */}
        <div className="play-widget">{body}</div>
        <PlayActions>
          <PlayPrimary onClick={onComplete}>
            {t("session.continue")}
            <ArrowRight className="ml-1.5 size-4" />
          </PlayPrimary>
        </PlayActions>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <p
          className={
            newUi
              ? "mb-1.5 text-ui font-semibold text-muted-foreground"
              : "mb-1.5 text-ui font-semibold"
          }
        >
          {title ?? t("session.interactiveTitle")}
        </p>
        {prompt ? (
          <p className={newUi ? "text-read text-foreground" : "text-ui text-foreground"}>
            <MathText text={prompt} />
          </p>
        ) : (
          <p className="text-caption text-muted-foreground">{t("session.interactiveHint")}</p>
        )}
      </div>

      {body}

      <div className="flex justify-end">
        <Button onClick={onComplete}>
          {t("session.continue")}
          <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
