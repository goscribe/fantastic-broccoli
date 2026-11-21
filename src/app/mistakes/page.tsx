"use client";

import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, PageShell } from "@/components/ui/page-header";
import { MistakesView } from "@/components/mistakes/mistakes-view";
import { mistakesApi } from "@/lib/api/mistakes";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/mistakes";

/** Every saved mistake, overall or for one subject (`?workspace=<id>`). */
function MistakesPageInner() {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const workspaceId = params.get("workspace") ?? undefined;
  const focusMistakeId = params.get("mistake") ?? undefined;
  const sessionId = params.get("session") ?? undefined;
  const { data: overall } = useQuery({ queryKey: ["mistakes-summary", null], queryFn: () => mistakesApi.summary() });
  const subject = overall?.subjects.find((s) => s.workspaceId === workspaceId);

  return (
    <PageShell max="max-w-3xl">
        <PageHeader
          back={workspaceId ? { href: `/workspace/${workspaceId}`, label: subject?.title ?? t("mistakes.allSubjects") } : undefined}
          title={t("mistakes.title")}
          mascot="think"
          subtitle={subject ? t("mistakes.subjectSubtitle").replace("{subject}", subject.title) : t("mistakes.subtitle")}
        />
        <MistakesView
          workspaceId={workspaceId}
          onWorkspaceChange={(id) => router.replace(id ? `${pathname}?workspace=${encodeURIComponent(id)}` : pathname)}
          focusMistakeId={focusMistakeId}
          sessionId={sessionId}
          onClearSession={() => router.replace(workspaceId ? `${pathname}?workspace=${encodeURIComponent(workspaceId)}` : pathname)}
        />
    </PageShell>
  );
}

export default function MistakesPage() {
  return (
    <Suspense fallback={null}>
      <MistakesPageInner />
    </Suspense>
  );
}
