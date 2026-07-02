"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getWorkspace } from "@/lib/mock-data";
import { SessionCard } from "@/components/session/session-card";
import { SessionCreateWizard } from "@/components/session/session-create-wizard";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDuration } from "@/lib/utils";
import {
  ArrowLeft,
  Plus,
  Clock,
  Sparkles,
  BookOpen,
  FlaskConical,
  Dna,
  Sigma,
} from "lucide-react";

const iconMap: Record<string, React.ElementType> = {
  flask: FlaskConical,
  dna: Dna,
  sigma: Sigma,
  default: BookOpen,
};

export default function WorkspaceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;
  const [showCreateWizard, setShowCreateWizard] = useState(false);

  const workspace = getWorkspace(workspaceId);

  if (!workspace) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Workspace not found</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/")}
            className="mt-2"
          >
            Go back
          </Button>
        </div>
      </div>
    );
  }

  const Icon = iconMap[workspace.icon] || iconMap.default;
  const activeSessions = workspace.sessions.filter(
    (s) => s.status === "active",
  );
  const completedSessions = workspace.sessions.filter(
    (s) => s.status === "completed",
  );
  const totalMinutes = activeSessions.reduce(
    (sum, s) => sum + s.durationMinutes,
    0,
  );

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Workspaces
          </button>

          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg flex-shrink-0"
              style={{ backgroundColor: workspace.color + "15" }}
            >
              <Icon className="h-5 w-5" style={{ color: workspace.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold tracking-tight truncate">
                {workspace.title}
              </h1>
              {workspace.description && (
                <p className="text-sm text-muted-foreground truncate">
                  {workspace.description}
                </p>
              )}
            </div>
          </div>

          {workspace.totalProgress > 0 && (
            <ProgressBar
              value={workspace.totalProgress}
              className="mt-3"
              size="sm"
              showLabel
            />
          )}
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 space-y-6">
        {/* Quick stats */}
        {activeSessions.length > 0 && (
          <div className="flex items-center gap-4 text-sm">
            <Badge variant="accent">
              {activeSessions.length} active{" "}
              {activeSessions.length === 1 ? "session" : "sessions"}
            </Badge>
            <span className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {formatDuration(totalMinutes)} planned
            </span>
          </div>
        )}

        {/* Today's suggestion — the study-centric UX */}
        {activeSessions.length > 0 && (
          <Card className="border-accent/20 bg-gradient-to-br from-accent/5 to-transparent">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-accent" />
              <span className="text-sm font-semibold">Continue studying</span>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Pick up where you left off
            </p>
            <button
              type="button"
              onClick={() =>
                router.push(
                  `/workspace/${workspaceId}/session/${activeSessions[0].id}`,
                )
              }
              className="w-full text-left p-3 rounded-lg bg-card border border-border hover:border-accent/30 group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    {activeSessions[0].title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {activeSessions[0].progress}% complete &middot;{" "}
                    {formatDuration(activeSessions[0].durationMinutes)}
                  </p>
                </div>
                <Badge variant="accent" className="group-hover:bg-accent group-hover:text-accent-foreground">
                  Resume
                </Badge>
              </div>
              <ProgressBar
                value={activeSessions[0].progress}
                className="mt-2"
                size="sm"
              />
            </button>
          </Card>
        )}

        {/* Sessions list */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Study sessions</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCreateWizard(true)}
              className="text-accent"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              New session
            </Button>
          </div>

          {workspace.sessions.length === 0 ? (
            <Card className="text-center py-10">
              <Sparkles className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium">No sessions yet</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4 max-w-sm mx-auto">
                Create a study session and Scribe will build a personalized plan
                with readings, quizzes, and comprehension checks.
              </p>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowCreateWizard(true)}
              >
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                Create first session
              </Button>
            </Card>
          ) : (
            <div className="space-y-3">
              {workspace.sessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  onClick={(id) =>
                    router.push(`/workspace/${workspaceId}/session/${id}`)
                  }
                />
              ))}
            </div>
          )}
        </section>

        {/* Completed */}
        {completedSessions.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold mb-3 text-muted-foreground">
              Completed
            </h2>
            <div className="space-y-3 opacity-60">
              {completedSessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  onClick={(id) =>
                    router.push(`/workspace/${workspaceId}/session/${id}`)
                  }
                />
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Create wizard */}
      {showCreateWizard && (
        <SessionCreateWizard
          workspaceTitle={workspace.title}
          onClose={() => setShowCreateWizard(false)}
          onCreate={() => {
            setShowCreateWizard(false);
          }}
        />
      )}
    </div>
  );
}
