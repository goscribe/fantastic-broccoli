"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { mockWorkspaces, mockFolders } from "@/lib/mock-data";
import { WorkspaceCard } from "@/components/workspace/workspace-card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Badge } from "@/components/ui/badge";
import {
  FolderOpen,
  Search,
  Flame,
} from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const allWorkspaces = mockWorkspaces;
  const folders = mockFolders;

  const filtered = searchQuery
    ? allWorkspaces.filter(
        (w) =>
          w.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          w.description?.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : null;

  const activeSessionCount = allWorkspaces.reduce(
    (sum, w) => sum + w.sessions.filter((s) => s.status === "active").length,
    0,
  );

  const totalProgress = allWorkspaces.length > 0
    ? Math.round(
        allWorkspaces.reduce((sum, w) => sum + w.totalProgress, 0) /
          allWorkspaces.length,
      )
    : 0;

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight">Scribe</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Your study sessions
              </p>
            </div>
            <div className="flex items-center gap-2">
              {activeSessionCount > 0 && (
                <Badge variant="accent">
                  <Flame className="h-3 w-3 mr-1" />
                  {activeSessionCount} active
                </Badge>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 space-y-6">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search workspaces..."
            className="w-full h-10 pl-9 pr-4 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
          />
        </div>

        {/* Overall progress */}
        {totalProgress > 0 && (
          <div className="flex items-center gap-3 px-1">
            <span className="text-xs text-muted-foreground">Overall</span>
            <ProgressBar value={totalProgress} className="flex-1" size="sm" showLabel />
          </div>
        )}

        {/* Search results */}
        {filtered ? (
          <section>
            <p className="text-xs text-muted-foreground mb-3">
              {filtered.length} result{filtered.length !== 1 ? "s" : ""}
            </p>
            <div className="space-y-3">
              {filtered.map((ws) => (
                <WorkspaceCard
                  key={ws.id}
                  workspace={ws}
                  onClick={(id) => router.push(`/workspace/${id}`)}
                />
              ))}
            </div>
          </section>
        ) : (
          <>
            {/* Folders */}
            {folders.map((folder) => (
              <section key={folder.id}>
                <div className="flex items-center gap-2 mb-3">
                  <FolderOpen
                    className="h-4 w-4"
                    style={{ color: folder.color }}
                  />
                  <h2 className="text-sm font-semibold">{folder.name}</h2>
                  <span className="text-xs text-muted-foreground">
                    {folder.workspaces.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {folder.workspaces.map((ws) => (
                    <WorkspaceCard
                      key={ws.id}
                      workspace={ws}
                      onClick={(id) => router.push(`/workspace/${id}`)}
                    />
                  ))}
                </div>
              </section>
            ))}

            {/* Unfiled workspaces */}
            {allWorkspaces.filter((w) => !w.folderId).length > 0 && (
              <section>
                <h2 className="text-sm font-semibold mb-3">All workspaces</h2>
                <div className="space-y-3">
                  {allWorkspaces
                    .filter((w) => !w.folderId)
                    .map((ws) => (
                      <WorkspaceCard
                        key={ws.id}
                        workspace={ws}
                        onClick={(id) => router.push(`/workspace/${id}`)}
                      />
                    ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
