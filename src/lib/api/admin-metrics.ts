import { rpc } from "./study-session";

// ── Admin Metrics page (admin.getMetrics*) ─────────────────────────────
// Shapes mirror the server's AdminGrowthMetricsService / AdminBusinessMetricsService.

export const METRIC_DAYS = [7, 30, 90] as const;
export type MetricDays = (typeof METRIC_DAYS)[number];

export type MetricChange = { value: number; kind: "percent" | "points" } | null;

export interface Compared {
  current: number | null;
  previous: number | null;
  change: MetricChange;
}

interface WindowOut {
  days: MetricDays;
  previousFrom: Date;
  from: Date;
  to: Date;
}

export interface ActivationFunnel extends WindowOut {
  steps: Array<{
    key: string;
    label: string;
    definition: string;
    current: { users: number; base: number; pctOfSignups: number | null; dropFromPrevious: number | null };
    previous: { users: number; base: number; pctOfSignups: number | null };
    change: MetricChange;
  }>;
  firstSubjectSplit: Array<{
    key: string;
    label: string;
    current: { users: number; pctOfSignups: number | null };
    previous: { users: number; pctOfSignups: number | null };
  }>;
  everUsed: Array<{
    key: string;
    label: string;
    definition: string;
    current: { users: number; pctOfSignups: number | null };
    previous: { users: number; pctOfSignups: number | null };
    change: MetricChange;
  }>;
}

export type RetentionKey = "d1" | "d3" | "d7" | "w1" | "w4";
export type RetentionCell = { retained: number; eligible: number; pct: number | null };
export type RetentionLine = { signups: number } & Record<RetentionKey, RetentionCell>;

export interface RetentionCohorts extends WindowOut {
  definitions: Record<RetentionKey, string>;
  weeks: Array<{ week: Date } & RetentionLine>;
  total: { current: RetentionLine; previous: RetentionLine; change: Record<RetentionKey, MetricChange> };
  bySource: Array<{ key: string; label: string; current: RetentionLine; previous: RetentionLine; change: Record<RetentionKey, MetricChange> }>;
}

export type EngagementUnit = "count" | "percent" | "ratio" | "minutes";

export interface Engagement extends WindowOut {
  metrics: Array<{ key: string; label: string; unit: EngagementUnit; definition: string } & Compared>;
  activeUsers: { current: number; previous: number };
  dauSeries: Array<{ day: Date; dau: number }>;
}

export interface UploadsPeriod {
  attempted: number;
  succeeded: number;
  processing: number;
  failed: number;
  successRate: number | null;
  reasons: Record<"size" | "type" | "extraction" | "stuck" | "transfer" | "refused", number>;
  topMessages: Array<{ message: string; reason: string; count: number }>;
  byType: Array<{ label: string; attempted: number; succeeded: number; failed: number; successRate: number | null }>;
  byDevice: Array<{ label: string; attempted: number; succeeded: number; failed: number; successRate: number | null }>;
  medianMinutesToReady: number | null;
  readyMeasured: number;
}

export interface UploadsHealth extends WindowOut {
  stuckAfterMinutes: number;
  current: UploadsPeriod;
  previous: UploadsPeriod;
  change: Record<"attempted" | "successRate" | "failed" | "medianMinutesToReady", MetricChange>;
  trackingSince: { clientFailures: Date | null; timeToReady: Date | null; expected: string };
}

type PlanProvider = { plan: string; provider: string; value: number };

export interface RevenueMetrics extends WindowOut {
  checkout: {
    attempts: Compared;
    opened: Compared;
    failed: Compared;
    users: Compared;
    byPlan: Array<{ plan: string; current: { attempts: number; opened: number; failed: number }; previous: { attempts: number; opened: number; failed: number } }>;
    errors: Array<{ message: string; current: number; previous: number }>;
    blocked: Array<{ detail: string; stage: string; current: number; previous: number }>;
    openedByProvider: PlanProvider[];
    openedByProviderPrevious: PlanProvider[];
    providerTrackingSince: Date | null;
  };
  conversion: {
    subscribedRate: Compared;
    paidRate: Compared;
    current: { starters: number; subscribed: number; paid: number };
    previous: { starters: number; subscribed: number; paid: number };
  };
  newSubscriptions: { total: Compared; byPlanProvider: PlanProvider[] };
  payments: { count: Compared; cashCents: Compared; byPlanProvider: Array<PlanProvider & { payments: number }> };
  subscribersNow: { paying: number; trialing: number; mrr: number; byPlan: Array<{ plan: string; paying: number; trialing: number; mrr: number }> };
  cancellations: { total: Compared; afterPaying: Compared; duringTrial: Compared; churnRate: Compared };
  complimentary: Array<{ kind: string; label: string; outstanding: number; grantedCurrent: number; grantedPrevious: number }>;
  courseworkCredits: { grantedAllTime: number; usedAllTime: number; outstanding: number; granted: Compared; used: Compared };
}

export interface LimitLine {
  users: number;
  hits: number;
  checkoutWithin7d: number;
  upgradedWithin7d: number;
  checkoutRate: number | null;
  upgradeRate: number | null;
  stillInWindow: number;
}

export interface PaywallMetrics extends WindowOut {
  limits: Array<{ key: string; label: string; current: LimitLine; previous: LimitLine; change: Record<"users" | "checkoutRate" | "upgradeRate", MetricChange> }>;
  walls: Array<{ reason: string; current: { shown: number; users: number }; previous: { shown: number; users: number } }>;
}

export interface FeatureValue {
  count: number;
  users: number;
  extra: number | null;
}

export interface FeatureAdoption extends WindowOut {
  features: Array<{
    key: string;
    label: string;
    definition: string;
    since: Date | null;
    trackingNew: boolean;
    extraLabel: string | null;
    current: FeatureValue;
    previous: FeatureValue;
    change: MetricChange;
    usersChange: MetricChange;
  }>;
  confidence: { answerRate: Compared; distribution: Array<{ confidence: number; current: number; previous: number }> };
  examSources: Array<{ source: string; current: number; previous: number }>;
}

export interface ContentQuality extends WindowOut {
  postFixFrom: Date;
  definition: string;
  defectRate: Compared & { runs: { current: number; previous: number } };
  lastRuns: Array<{
    id: string;
    createdAt: Date;
    windowStart: Date;
    windowEnd: Date;
    model: string;
    postFix: boolean;
    itemsChecked: number;
    highDefects: number;
    mediumDefects: number;
    mistakeReviewItemsExcluded: number;
    mistakeReviewHighExcluded: number;
    defectRate: number | null;
    rawDefectRate: number | null;
    judgeFlagRate: number | null;
  }>;
}

export interface AiCost extends WindowOut {
  definition: string;
  total: Compared;
  perActiveUser: Compared;
  perSession: Compared;
  costToRevenuePct: Compared;
  revenueUsd: Compared;
  byModel: Array<{ feature: string; model: string; measured: boolean; calls: number; usd: number; previousUsd: number }>;
}

export type MetricUserList = "activation" | "streak" | "limit" | "paying" | "uploadFailed";

export interface MetricUsers {
  list: MetricUserList;
  key: string;
  missed: boolean;
  users: Array<{ id: string; email: string | null; name: string | null; createdAt: Date }>;
}

const q = <T,>(path: string, days: MetricDays) => rpc<T>(`admin.${path}`, "query", { days });

export const adminMetricsApi = {
  activation: (days: MetricDays) => q<ActivationFunnel>("getMetricsActivation", days),
  retention: (days: MetricDays) => q<RetentionCohorts>("getMetricsRetention", days),
  engagement: (days: MetricDays) => q<Engagement>("getMetricsEngagement", days),
  uploads: (days: MetricDays) => q<UploadsHealth>("getMetricsUploads", days),
  revenue: (days: MetricDays) => q<RevenueMetrics>("getMetricsRevenue", days),
  paywall: (days: MetricDays) => q<PaywallMetrics>("getMetricsPaywall", days),
  features: (days: MetricDays) => q<FeatureAdoption>("getMetricsFeatures", days),
  quality: (days: MetricDays) => q<ContentQuality>("getMetricsQuality", days),
  aiCost: (days: MetricDays) => q<AiCost>("getMetricsAiCost", days),
  users: (input: { list: MetricUserList; key: string; days: MetricDays; missed?: boolean }) =>
    rpc<MetricUsers>("admin.getMetricUsers", "query", input),
};
