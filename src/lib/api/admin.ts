import { rpc } from "./study-session";

/**
 * Typed client for the server's `admin` tRPC router.
 *
 * The published @goscribe/server package predates the content-QA procedures
 * (`getWorkspaceContent`, `getArtifactContent`, `getStudySessionContent`,
 * `setArtifactArchived`), so — as with study-session.ts — the contracts below
 * mirror the router's zod schemas and Prisma models 1:1.
 */

export type ArtifactType =
  | "STUDY_GUIDE"
  | "FLASHCARD_SET"
  | "WORKSHEET"
  | "MEETING_SUMMARY"
  | "PODCAST_EPISODE"
  | "STORAGE";

export type ArtifactKind =
  | "WORKSHEET"
  | "MCQ_POOL"
  | "FLASHCARD_DECK"
  | "VOCAB_DECK"
  | "CLOZE_PASSAGE"
  | "READING_CHUNK"
  | "FIGURE";

export type ActivityLogCategory =
  | "AUTH"
  | "WORKSPACE"
  | "BILLING"
  | "ADMIN"
  | "CONTENT"
  | "SYSTEM";

export type ActivityLogStatus = "SUCCESS" | "FAILURE";

export type FileAnalysisStatus =
  | "NOT_ANALYZED"
  | "QUEUED"
  | "ANALYZING"
  | "ANALYZED"
  | "FAILED";

export interface AdminUserRef {
  id: string;
  name: string | null;
  email: string | null;
}

export interface SystemStats {
  totalUsers: number;
  totalWorkspaces: number;
  totalSubscriptions: number;
  revenue: number;
  subscriptionRevenue: number;
  topupRevenue: number;
}

export interface RetentionWindow {
  eligible: number;
  retained: number;
}

export interface RetentionChannelRow {
  channel: string;
  signups: number;
  activated: number;
  d1: RetentionWindow;
  d3: RetentionWindow;
  d7: RetentionWindow;
}

export interface RetentionStats {
  signups: number;
  verified: number;
  activated: number;
  channels: RetentionChannelRow[];
}

export interface ClientSegmentRow {
  label: string;
  users: number;
  calls: number;
  /** Share of calls that failed, 0-100. */
  errorRate: number;
}

export interface ClientStats {
  since: string;
  totalUsers: number;
  totalCalls: number;
  devices: ClientSegmentRow[];
  operatingSystems: ClientSegmentRow[];
  browsers: ClientSegmentRow[];
}

export interface CostOperationRow {
  /** Ledger description of the billable action, e.g. "studySession.create". */
  label: string;
  count: number;
  tokens: number;
  estCostUsd: number;
}

export interface CostUserRow {
  userId: string;
  email: string | null;
  plan: string;
  monthlyRevenueUsd: number;
  tokensSpent: number;
  operations: number;
  estCostUsd: number;
  marginUsd: number;
}

export interface CostAnalytics {
  since: string;
  /** Cost figures are per-operation estimates, not measured provider usage. */
  estimated: boolean;
  revenue: {
    mrrUsd: number;
    activePaidSubs: number;
    collectedUsd: number;
    topupCollectedUsd: number;
    plans: Array<{
      name: string;
      priceUsd: number;
      monthlyTokens: number;
      activeSubs: number;
      totalSubs: number;
    }>;
  };
  tokens: {
    granted: number;
    spent: number;
    spenders: number;
    p50: number;
    p90: number;
    p99: number;
    max: number;
  };
  operations: CostOperationRow[];
  estCostUsd: number;
  grossMarginUsd: number;
  topSpenders: CostUserRow[];
}

export interface AdminUser {
  id: string;
  name: string | null;
  email: string | null;
  emailVerified: Date | null;
  createdAt: Date;
  profilePicture: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  gclid: string | null;
  signupReferrer: string | null;
  role: { id: string; name: string } | null;
  subscriptions: Array<{
    id: string;
    status: string;
    plan: { id: string; name: string } | null;
  }>;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface AdminInvoice {
  id: string;
  status: string;
  type: "SUBSCRIPTION" | "TOPUP" | null;
  amountPaid: number;
  currency: string | null;
  stripeInvoiceId: string | null;
  createdAt: Date;
  user: (AdminUserRef & { profilePicture: string | null }) | null;
  subscription: { plan: { name: string } | null } | null;
}

export interface AdminPlan {
  id: string;
  name: string;
  description: string | null;
  type: string;
  price: number;
  interval: string | null;
  active: boolean;
  monthlyTokens: number;
  stripePriceId: string | null;
  limit: { maxStorageBytes: number | bigint } | null;
}

export interface AdminWorkspaceRow {
  id: string;
  title: string;
  description: string | null;
  icon: string;
  createdAt: Date;
  updatedAt: Date;
  fileBeingAnalyzed: boolean;
  needsAnalysis: boolean;
  owner: AdminUserRef;
  _count: {
    artifacts: number;
    uploads: number;
    studySessions: number;
    members: number;
  };
}

export interface AdminArtifactRow {
  id: string;
  title: string;
  description: string | null;
  type: ArtifactType;
  kind: ArtifactKind | null;
  topic: string | null;
  isArchived: boolean;
  generating: boolean;
  usedCount: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: AdminUserRef | null;
  _count: {
    flashcards: number;
    questions: number;
    podcastSegments: number;
    versions: number;
  };
}

export interface AdminSessionRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  depth: string;
  progress: number;
  generating: boolean;
  createdAt: Date;
  user: AdminUserRef;
  _count: { activities: number };
}

export interface AdminWorkspaceContent {
  id: string;
  title: string;
  description: string | null;
  icon: string;
  createdAt: Date;
  updatedAt: Date;
  owner: AdminUserRef;
  members: Array<{ role: string; user: AdminUserRef }>;
  uploads: Array<{
    id: string;
    name: string;
    mimeType: string;
    size: number;
    analysisStatus: FileAnalysisStatus;
    analysisError: string | null;
    createdAt: Date;
  }>;
  artifacts: AdminArtifactRow[];
  studySessions: AdminSessionRow[];
}

export interface AdminArtifactContent extends Omit<AdminArtifactRow, "_count"> {
  workspace: { id: string; title: string };
  content: unknown;
  latestVersion: {
    id: string;
    version: number;
    content: string;
    data: unknown;
    createdAt: Date;
  } | null;
  flashcards: Array<{ id: string; front: string; back: string; order: number }>;
  questions: Array<{
    id: string;
    prompt: string;
    answer: string | null;
    type: string;
    difficulty: string;
    order: number;
  }>;
  podcastSegments: Array<{
    id: string;
    title: string;
    content: string;
    duration: number;
    order: number;
    keyPoints: string[];
  }>;
}

export interface AdminSessionContent {
  id: string;
  title: string;
  description: string | null;
  status: string;
  depth: string;
  progress: number;
  createdAt: Date;
  workspace: { id: string; title: string };
  user: AdminUserRef;
  activities: Array<{
    id: string;
    type: string;
    title: string;
    description: string | null;
    status: string;
    order: number;
    estimatedMinutes: number;
    content: unknown;
  }>;
}

export interface AdminActivityLogRow {
  id: string;
  createdAt: Date;
  action: string;
  description: string;
  category: ActivityLogCategory;
  trpcPath: string | null;
  status: ActivityLogStatus;
  durationMs: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  ipAddress: string | null;
  actor: AdminUserRef | null;
  workspace: { id: string; title: string } | null;
  metadata: unknown;
}

export interface ActivityLogFilters {
  search?: string;
  category?: ActivityLogCategory;
  status?: ActivityLogStatus;
  from?: Date;
  to?: Date;
  workspaceId?: string;
  actorUserId?: string;
  /** Narrow to one rejection reason, e.g. "FORBIDDEN". */
  errorCode?: string;
  /** Admin accounts' own traffic is filtered out unless this is set. */
  includeAdminActors?: boolean;
}

export interface QualityFlag {
  kind: string;
  detail: string;
}

export interface QualityAssessment {
  id: string;
  workspaceId: string;
  model: string;
  materialFitScore: number;
  materialFitNotes: string;
  generationQualityScore: number;
  generationQualityNotes: string;
  flags: QualityFlag[];
  inputStats: {
    uploadCount: number;
    analyzedUploadCount: number;
    artifactCount: number;
    studySessionCount: number;
    materialChars: number;
    artifactChars: number;
  } | null;
  createdAt: Date;
  workspace?: { title: string; ownerId: string; updatedAt: Date };
}

export interface QualitySummary {
  sinceDays: number;
  workspaceCount: number;
  avgMaterialFit: number | null;
  avgGenerationQuality: number | null;
  lowQualityCount: number;
  flagCounts: Record<string, number>;
}

export interface BatchAssessResult {
  assessed: number;
  results: Array<{
    workspaceId: string;
    title: string;
    materialFitScore?: number;
    generationQualityScore?: number;
    error?: string;
  }>;
}

export const adminApi = {
  getSystemStats: () => rpc<SystemStats>("admin.getSystemStats", "query", undefined),

  getRetentionStats: (since?: Date) =>
    rpc<RetentionStats>("admin.getRetentionStats", "query", since ? { since } : undefined),

  getClientStats: (since?: Date) =>
    rpc<ClientStats>("admin.getClientStats", "query", since ? { since } : undefined),

  getCostAnalytics: (since?: Date) =>
    rpc<CostAnalytics>("admin.getCostAnalytics", "query", since ? { since } : undefined),

  listUsers: (input: {
    page: number;
    pageSize: number;
    search?: string;
    emailVerified?: "all" | "yes" | "no";
  }) =>
    rpc<PageMeta & { users: AdminUser[] }>(
      "admin.listUsers",
      "query",
      input,
    ),

  updateUserRole: (userId: string, roleName: string) =>
    rpc<{ id: string }>("admin.updateUserRole", "mutation", { userId, roleName }),

  listInvoices: (input: { page: number; pageSize: number; search?: string }) =>
    rpc<PageMeta & { items: AdminInvoice[] }>(
      "admin.listInvoices",
      "query",
      input,
    ),

  listRecentInvoices: (limit: number) =>
    rpc<AdminInvoice[]>("admin.listRecentInvoices", "query", { limit }),

  listPlans: () => rpc<AdminPlan[]>("admin.listPlans", "query", undefined),

  listWorkspaces: (input: {
    limit: number;
    cursor?: string | null;
    search?: string;
    /** Admin accounts' own workspaces are hidden unless this is set. */
    includeAdminOwned?: boolean;
  }) =>
    rpc<{
      workspaces: AdminWorkspaceRow[];
      nextCursor?: string | null;
      totalCount: number;
    }>("admin.listWorkspaces", "query", input),

  getWorkspaceContent: (workspaceId: string, includeAdminGenerated = false) =>
    rpc<AdminWorkspaceContent>("admin.getWorkspaceContent", "query", {
      workspaceId,
      includeAdminGenerated,
    }),

  getArtifactContent: (artifactId: string) =>
    rpc<AdminArtifactContent>("admin.getArtifactContent", "query", { artifactId }),

  getStudySessionContent: (sessionId: string) =>
    rpc<AdminSessionContent>("admin.getStudySessionContent", "query", { sessionId }),

  setArtifactArchived: (artifactId: string, isArchived: boolean) =>
    rpc<{ id: string; isArchived: boolean }>(
      "admin.setArtifactArchived",
      "mutation",
      { artifactId, isArchived },
    ),

  activityList: (input: ActivityLogFilters & { page: number; limit: number }) =>
    rpc<PageMeta & { items: AdminActivityLogRow[] }>(
      "admin.activityList",
      "query",
      input,
    ),

  activityErrorBreakdown: (input: ActivityLogFilters) =>
    rpc<Array<{ errorCode: string; count: number }>>(
      "admin.activityErrorBreakdown",
      "query",
      input,
    ),

  activityExportCsv: (input: ActivityLogFilters & { maxRows?: number }) =>
    rpc<{ csv: string; count: number }>("admin.activityExportCsv", "query", input),

  assessWorkspaceQuality: (workspaceId: string) =>
    rpc<QualityAssessment>("admin.assessWorkspaceQuality", "mutation", {
      workspaceId,
    }),

  assessRecentWorkspaces: (input: { limit?: number; staleDays?: number }) =>
    rpc<BatchAssessResult>("admin.assessRecentWorkspaces", "mutation", input),

  qualitySummary: (sinceDays: number) =>
    rpc<QualitySummary>("admin.qualitySummary", "query", { sinceDays }),

  listQualityAssessments: (input: { workspaceId?: string; limit?: number }) =>
    rpc<QualityAssessment[]>("admin.listQualityAssessments", "query", input),
};
