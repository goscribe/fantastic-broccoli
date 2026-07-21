"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchWorkspace } from "@/lib/api/workspace";
import {
  deletePodcastEpisode,
  fetchPodcastCharacters,
  fetchPodcastEpisodes,
  generatePodcastEpisode,
  PodcastCharacter,
  PodcastEpisode,
} from "@/lib/api/podcast";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { Button } from "@/components/ui/button";
import { ListRowsSkeleton, Skeleton } from "@/components/ui/skeleton";
import { toast, toastError } from "@/lib/toast";
import { cn, formatRelativeDate } from "@/lib/utils";
import Image from "next/image";
import {
  AudioLines,
  ChevronDown,
  ChevronUp,
  Headphones,
  Loader2,
  Mic,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

const COVER_GRADIENTS = [
  "from-accent to-accent-bright",
  "from-violet to-sky",
  "from-rose to-amber",
  "from-sky to-accent-bright",
];

function CharacterCard({
  character,
  index,
  selected,
  onSelect,
}: {
  character: PodcastCharacter;
  index: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "group w-28 shrink-0 overflow-hidden rounded-2xl border text-left transition sm:w-32",
        selected
          ? "border-accent bg-accent-soft ring-2 ring-accent/30"
          : "border-border bg-card hover:border-border-strong hover:bg-card-hover",
      )}
    >
      <div className="aspect-square w-full">
        {character.imageUrl ? (
          <Image
            src={character.imageUrl}
            alt={character.name}
            width={128}
            height={128}
            unoptimized
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className={cn(
              "flex h-full w-full items-center justify-center bg-gradient-to-br text-accent-foreground",
              COVER_GRADIENTS[index % COVER_GRADIENTS.length],
            )}
          >
            <Mic className="h-7 w-7 opacity-90" />
          </div>
        )}
      </div>
      <div className="px-2.5 py-2">
        <p className="truncate text-xs font-semibold">{character.name}</p>
        <p className="truncate text-[10px] text-muted-foreground">
          {character.tagline}
        </p>
      </div>
    </button>
  );
}

function episodeDuration(episode: PodcastEpisode): string | null {
  const total = episode.segments.reduce((sum, s) => sum + (s.duration ?? 0), 0);
  if (!total) return null;
  const mins = Math.round(total / 60);
  return mins < 1 ? "<1 min" : `${mins} min`;
}

function EpisodeCover({
  episode,
  episodeNumber,
}: {
  episode: PodcastEpisode;
  episodeNumber: number;
}) {
  if (episode.imageUrl) {
    return (
      <Image
        src={episode.imageUrl}
        alt=""
        width={112}
        height={112}
        unoptimized
        className="h-full w-full rounded-xl object-cover"
      />
    );
  }
  return (
    <div
      className={cn(
        "flex h-full w-full flex-col items-center justify-center rounded-xl bg-gradient-to-br text-accent-foreground",
        COVER_GRADIENTS[(episodeNumber - 1) % COVER_GRADIENTS.length],
      )}
    >
      <Headphones className="h-7 w-7" />
      <span className="mt-1 text-[10px] font-bold uppercase tracking-widest opacity-80">
        Scribe FM
      </span>
    </div>
  );
}

/** Spotify-style tracklist row: number, cover thumb, title, meta, expandable chapters. */
function EpisodeRow({
  episode,
  episodeNumber,
  onDelete,
}: {
  episode: PodcastEpisode;
  episodeNumber: number;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const playable = episode.segments.filter((s) => s.audioUrl);
  const duration = episodeDuration(episode);
  const canExpand = playable.length > 0 && !episode.generating;

  return (
    <div className="group rounded-lg transition-colors hover:bg-muted/50">
      <div className="flex items-center">
        <button
          type="button"
          disabled={!canExpand}
          onClick={() => setExpanded((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left sm:gap-4 sm:px-4"
        >
        <span className="w-5 shrink-0 text-center text-sm tabular-nums text-muted-foreground">
          {episodeNumber}
        </span>
        <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md">
          <EpisodeCover episode={episode} episodeNumber={episodeNumber} />
          {episode.generating && (
            <span className="absolute inset-0 flex items-center justify-center bg-ink/50">
              <Loader2 className="h-4 w-4 animate-spin text-white" />
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">
            {episode.title}
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {episode.generating ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-accent-dim">
                <AudioLines className="h-3 w-3 animate-pulse" />
                Generating episode…
              </span>
            ) : (
              (episode.description ??
                `${playable.length} ${playable.length === 1 ? "chapter" : "chapters"}`)
            )}
          </span>
        </span>
        <span className="hidden shrink-0 text-xs tabular-nums text-muted-foreground sm:block">
          {formatRelativeDate(episode.createdAt)}
          {duration && ` · ${duration}`}
        </span>
          {canExpand &&
            (expanded ? (
              <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0 text-faint" />
            ))}
        </button>
        <button
          type="button"
          aria-label="Delete episode"
          onClick={onDelete}
          className="mr-2 shrink-0 rounded p-1.5 text-faint opacity-0 transition-opacity hover:bg-muted hover:text-rose group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {expanded && playable.length > 0 && (
        <div className="space-y-2.5 border-t border-border/60 px-4 py-3 sm:pl-[4.75rem]">
          {playable.map((segment, i) => (
            <div key={segment.id} className="space-y-1">
              <p className="text-[11px] font-medium text-muted-foreground">
                <span className="mr-1.5 tabular-nums text-faint">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {segment.title || `Chapter ${i + 1}`}
              </p>
              <audio
                controls
                preload="none"
                src={segment.audioUrl ?? undefined}
                className="h-9 w-full"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function WorkspaceRecallPage() {
  const params = useParams();
  const workspaceId = params.id as string;
  const queryClient = useQueryClient();
  const [showChooser, setShowChooser] = useState(false);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(
    null,
  );

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
  const { data: characters = [] } = useQuery({
    queryKey: ["podcast-characters"],
    queryFn: fetchPodcastCharacters,
    // Banners are generated lazily server-side; refetch to pick them up.
    refetchInterval: (query) =>
      query.state.data?.some((c) => !c.imageUrl) ? 15000 : false,
  });

  const selectedCharacter =
    characters.find((c) => c.id === selectedCharacterId) ?? characters[0];

  const generate = useMutation({
    mutationFn: generatePodcastEpisode,
    onSuccess: () => {
      toast.success("Podcast generation started — this takes a few minutes");
      setShowChooser(false);
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

  const startGeneration = () => {
    if (!selectedCharacter) return;
    generate.mutate({ workspaceId, character: selectedCharacter });
  };

  return (
    <WorkspaceShell workspace={workspace}>
      <div className="animate-fade-up -mx-4 -my-6 sm:-mx-8 sm:-my-8">
        {/* Spotify-style show header */}
        <div className="bg-gradient-to-b from-accent-soft via-accent-soft/40 to-transparent px-4 pb-6 pt-8 sm:px-8">
          <div className="flex items-end gap-5">
            <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-bright text-accent-foreground shadow-xl sm:h-40 sm:w-40">
              <div className="flex flex-col items-center">
                <Headphones className="h-10 w-10 sm:h-14 sm:w-14" />
                <span className="mt-1.5 text-[10px] font-bold uppercase tracking-widest opacity-80 sm:text-xs">
                  Scribe FM
                </span>
              </div>
            </div>
            <div className="min-w-0 pb-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Podcast
              </p>
              <h1 className="mt-1 truncate text-2xl font-extrabold tracking-tight sm:text-4xl">
                Passive Recall
              </h1>
              <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground sm:text-sm">
                Episodes generated from {workspace?.title ?? "this workspace"}
                &apos;s materials — revise while you walk, commute, or wind
                down.
              </p>
              <p className="mt-2 text-xs font-medium text-muted-foreground">
                {episodes.length}{" "}
                {episodes.length === 1 ? "episode" : "episodes"}
              </p>
            </div>
          </div>
          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowChooser(true)}
              className="flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-accent-foreground shadow-md transition hover:scale-[1.03] hover:bg-accent-bright"
            >
              <Sparkles className="h-4 w-4" />
              Generate episode
            </button>
          </div>
        </div>

        <div className="px-2 pb-8 sm:px-6">

          {episodes.length === 0 ? (
            <div className="mx-2 flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
              <Mic className="h-8 w-8 text-faint" />
              <p className="mt-3 text-sm font-medium">No episodes yet</p>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                Generate a podcast episode from this workspace&apos;s
                materials — revise while you walk, commute, or wind down.
              </p>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-3 border-b border-border px-3 pb-2 text-[11px] font-medium uppercase tracking-wide text-faint sm:gap-4 sm:px-4">
                <span className="w-5 text-center">#</span>
                <span className="w-12" />
                <span className="flex-1">Title</span>
                <span className="hidden sm:block">Released</span>
              </div>
              <div className="mt-1 space-y-0.5">
                {episodes.map((episode, i) => (
                  <EpisodeRow
                    key={episode.id}
                    episode={episode}
                    episodeNumber={episodes.length - i}
                    onDelete={() => remove.mutate(episode.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showChooser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          onClick={() => setShowChooser(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-border bg-card p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Pick your host</h2>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setShowChooser(false)}
                className="rounded p-1 text-faint hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {characters.map((character, i) => (
                <CharacterCard
                  key={character.id}
                  character={character}
                  index={i}
                  selected={selectedCharacter?.id === character.id}
                  onSelect={() => setSelectedCharacterId(character.id)}
                />
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-xs text-muted-foreground">
                {selectedCharacter
                  ? `${selectedCharacter.name} — ${selectedCharacter.tagline}`
                  : "Loading hosts…"}
              </p>
              <Button
                size="sm"
                onClick={startGeneration}
                disabled={generate.isPending || !selectedCharacter}
              >
                {generate.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Starting…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                    Generate podcast
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </WorkspaceShell>
  );
}
