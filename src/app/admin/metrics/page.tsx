"use client";

import { useState } from "react";
import { useIsFetching } from "@tanstack/react-query";
import { PageHeader } from "@/components/admin/admin-ui";
import { RangePicker, UserListProvider } from "@/components/admin/metrics/metrics-ui";
import { ActivationSection, EngagementSection, RetentionSection } from "@/components/admin/metrics/growth-sections";
import {
  AiCostSection,
  FeaturesSection,
  PaywallSection,
  QualitySection,
  RevenueSection,
  UploadsSection,
} from "@/components/admin/metrics/business-sections";
import { FirstScoresSection, StudySection } from "@/components/admin/metrics/study-sections";
import type { MetricDays } from "@/lib/api/admin-metrics";

const SECTIONS = [
  ["activation", "Activation"],
  ["retention", "Retention"],
  ["engagement", "Engagement"],
  ["uploads", "Uploads"],
  ["revenue", "Revenue"],
  ["paywall", "Limits"],
  ["features", "Features"],
  ["quality", "Quality"],
  ["cost", "AI cost"],
  ["study", "What students study"],
  ["scores", "First test scores"],
] as const;

/**
 * The numbers to decide with: activation, retention, engagement, uploads,
 * money, limits, feature use, content quality, AI cost, what students study
 * and their first test scores, each for the
 * chosen range against the same-length period before. Real users only.
 */
export default function AdminMetricsPage() {
  const [days, setDays] = useState<MetricDays>(30);
  const fetching = useIsFetching({ queryKey: ["admin", "metrics"] }) > 0;
  return (
    <UserListProvider days={days}>
      <PageHeader
        title="Metrics"
        description={`Last ${days} days against the ${days} days before. Real users only: internal, admin and deleted accounts are left out everywhere; admin free-access users also out of revenue and conversion. Numbers refresh every 5 minutes.`}
      />
      <div className="sticky top-0 z-10 -mx-6 mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-border bg-background/95 px-6 py-2 backdrop-blur">
        <nav className="flex flex-wrap gap-x-3 gap-y-1 text-[13px]">
          {SECTIONS.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="text-muted-foreground hover:text-accent">
              {label}
            </a>
          ))}
        </nav>
        <RangePicker days={days} onChange={setDays} busy={fetching} />
      </div>
      <ActivationSection days={days} />
      <RetentionSection days={days} />
      <EngagementSection days={days} />
      <UploadsSection days={days} />
      <RevenueSection days={days} />
      <PaywallSection days={days} />
      <FeaturesSection days={days} />
      <QualitySection days={days} />
      <AiCostSection days={days} />
      <StudySection days={days} />
      <FirstScoresSection days={days} />
    </UserListProvider>
  );
}
