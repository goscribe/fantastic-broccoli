"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchWorkspace } from "@/lib/api/workspace";
import {
  deletePodcastEpisode,
  fetchPodcastEpisodes,
  fetchPodcastVoices,
  generatePodcastEpisode,
  PodcastEpisode,
} from "@/lib/api/podcast";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { Button } from "@/components/ui/button";
import { ListRowsSkeleton, Skeleton } from "@/components/ui/skeleton";
import { toast, toastError } from "@/lib/toast";
import { formatRelativeDate } from "@/lib/utils";
import {
  Headphones,
  Loader2,
  Mic,
  Plus,
  Trash2,
  X,
} from "lucide-react";

function episodeDuration(episode: PodcastEpisode): string | null {
  const total = episode.segments.reduce((sum, s) => sum + (s.duration ?? 0), 0);
  if (!total) return null;
  const mins = Math.round(total / 60);
  return mins < 1 ? "<1 min" : `${mins} min`;
}

function EpisodeCard({
  episode,
  onDelete,
}: {
  episode: PodcastEpisode;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const playable = episode.segments.filter((s) => s.audioUrl);
  const duration = episodeDuration(episode);

  return (
    <div className="rounded-2xl border border-border bg-card px-5 py-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-dim">
          <Headphones className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{episode.title}</p>
          {episode.description && (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              {episode.description}
            </p>
          )}
          <p className="mt-1 text-[11px] text-faint">
            {formatRelativeDate(episode.createdAt)}
            {duration && ` · ${duration}`}
            {episode.generating && " · generating…"}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {episode.generating && (
            <Loader2 className="h-4 w-4 animate-spin text-accent" />
          )}
          <button
            type="button"
            aria-label="Delete episode"
            onClick={onDelete}
            className="rounded p-1.5 text-faint hover:bg-muted hover:text-rose"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      {playable.length > 0 && (
        <div className="mt-3 space-y-2">
          {(expanded ? playable : playable.slice(0, 1)).map((segment, i) => (
            <div key={segment.id} className="space-y-1">
              {playable.length > 1 && (
                <p className="text-[11px] font-medium text-muted-foreground">
                  {segment.title || `Segment ${i + 1}`}
                </p>
              )}
              <audio
                controls
                preload="none"
                src={segment.audioUrl ?? undefined}
                className="h-9 w-full"
              />
            </div>
          ))}
          {playable.length > 1 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-xs font-medium text-accent hover:text-accent-dim"
            >
              {expanded
                ? "Show less"
                : `Show all ${playable.length} segments`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function WorkspaceRecallPage() {
  const params = useParams();
  const workspaceId = params.id as string;
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [hostVoice, setHostVoice] = useState("alloy");
  const [guestVoice, setGuestVoice] = useState<string>("");

  const { data: workspace, isLoading: workspaceLoading } = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => fetchWorkspace(workspaceId),
  });
  const { data: episodes = [], isLoading: episodesLoading } = useQuery({
    queryKey: ["podcast-episodes", workspaceId],
    queryFn: () => fetchPodcastEpisodes(workspaceId),
    refetchInterval: (query) =>
      query.state.data?.some((e) => e.generating) ? 5000 : false,
  });
  const { data: voices = [] } = useQuery({
    queryKey: ["podcast-voices"],
    queryFn: fetchPodcastVoices,
  });

  const generate = useMutation({
    mutationFn: generatePodcastEpisode,
    onSuccess: () => {
      toast.success("Podcast generation started — this takes a few minutes");
      setShowCreate(false);
      setTitle("");
      setPrompt("");
      queryClient.invalidateQueries({
        queryKey: ["podcast-episodes", workspaceId],
      });
      // Generation runs in the background; poll until the episode appears.
      setTimeout(() => {
        queryClient.invalidateQueries({
          queryKey: ["podcast-episodes", workspaceId],
        });
      }, 5000);
    },
    onError: (err) => toastError(err, "Podcast generation failed"),
  });

  const remove = useMutation({
    mutationFn: deletePodcastEpisode,
    onSuccess: () => {
      toast.success("Episode deleted");
      queryClient.invalidateQueries({
        queryKey: ["podcast-episodes", workspaceId],
      });
    },
    onError: (err) => toastError(err, "Delete failed"),
  });

  if (workspaceLoading || episodesLoading) {
    return (
      <WorkspaceShell workspace={workspace} loading>
        <div className="space-y-4">
          <Skeleton className="h-8 w-52" />
          <ListRowsSkeleton count={3} />
        </div>
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell workspace={workspace}>
      <div className="space-y-5 animate-fade-up">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Passive recall</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Podcast episodes generated from your materials — listen back to
              revise passively.
            </p>
          </div>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New episode
          </Button>
        </div>

        {episodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
            <Mic className="h-8 w-8 text-faint" />
            <p className="mt-3 text-sm font-medium">No episodes yet</p>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              Generate a podcast episode from this workspace&apos;s materials
              and revise while you walk, commute, or wind down.
            </p>
            <Button
              size="sm"
              className="mt-4"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Generate episode
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {episodes.map((episode) => (
              <EpisodeCard
                key={episode.id}
                episode={episode}
                onDelete={() => remove.mutate(episode.id)}
              />
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Generate podcast episode</h2>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setShowCreate(false)}
                className="rounded p-1 text-faint hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form
              className="mt-4 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                generate.mutate({
                  workspaceId,
                  title,
                  userPrompt: prompt,
                  hostVoiceId: hostVoice,
                  guestVoiceId: guestVoice || undefined,
                });
              }}
            >
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  Title (optional)
                </p>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Enzymes crash course"
                  className="h-10 w-full rounded-lg border border-border bg-card px-3.5 text-sm placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
                />
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  Focus (optional)
                </p>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="What should the episode focus on?"
                  rows={2}
                  className="w-full rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    Host voice
                  </p>
                  <select
                    value={hostVoice}
                    onChange={(e) => setHostVoice(e.target.value)}
                    className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
                  >
                    {voices.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} — {v.description}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    Guest voice
                  </p>
                  <select
                    value={guestVoice}
                    onChange={(e) => setGuestVoice(e.target.value)}
                    className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
                  >
                    <option value="">None (solo host)</option>
                    {voices
                      .filter((v) => v.id !== hostVoice)
                      .map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} — {v.description}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={generate.isPending}>
                  {generate.isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      Starting…
                    </>
                  ) : (
                    "Generate"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </WorkspaceShell>
  );
}
