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
import { MathText } from "@/components/ui/markdown-text";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { Button } from "@/components/ui/button";
import { ListRowsSkeleton, Skeleton } from "@/components/ui/skeleton";
import { toast, toastError } from "@/lib/toast";
import { cn, formatRelativeDate } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/workspace";
import Image from "next/image";
import { EmptyScene } from "@/components/graphics/floating-decor";
import {
  AudioLines,
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

/** Stage label + progress bar for an episode that is still generating. */
function GenerationStatus({ message }: { message: string | null }) {
  const { t } = useI18n();
  const label = message || t("ws.generatingEpisode");
  const progress = message ? stageProgress(message) : null;
  return (
    <div className="mt-2 space-y-1.5">
      <p className="inline-flex items-center gap-1.5 text-xs font-medium text-accent-dim">
        <AudioLines className="h-3.5 w-3.5 animate-pulse" />
        {label}
      </p>
      {progress && (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-40 max-w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500"
              style={{
                width: `${Math.round((progress.done / progress.total) * 100)}%`,
              }}
            />
          </div>
          <span className="text-[11px] tabular-nums text-faint">
            {progress.done}/{progress.total}
          </span>
        </div>
      )}
    </div>
  );
}

/** Parses "(i of n)" out of a server stage message to drive the progress bar. */
function stageProgress(message: string): { done: number; total: number } | null {
  const m = message.match(/\((\d+) of (\d+)\)/);
  if (!m) return null;
  return { done: Number(m[1]), total: Number(m[2]) };
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

function EpisodeCard({
  episode,
  episodeNumber,
  onDelete,
}: {
  episode: PodcastEpisode;
  episodeNumber: number;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const playable = episode.segments.filter((s) => s.audioUrl);
  const duration = episodeDuration(episode);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-stretch gap-4 px-5 py-4">
        <div className="relative h-24 w-24 shrink-0 sm:h-28 sm:w-28">
          <EpisodeCover episode={episode} episodeNumber={episodeNumber} />
          {episode.generating && (
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-ink/50">
              <Loader2 className="h-5 w-5 animate-spin text-white" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent-dim">
              Ep. {episodeNumber}
            </span>
            <span className="text-[11px] text-faint">
              {formatRelativeDate(episode.createdAt)}
              {duration && ` · ${duration}`}
            </span>
          </div>
          <p className="mt-1.5 truncate text-base font-semibold">
            <MathText
              text={
                episode.generating && episode.title === "----"
                  ? t("ws.newEpisode")
                  : episode.title
              }
            />
          </p>
          {episode.description && (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              <MathText text={episode.description} />
            </p>
          )}
          {episode.generating ? (
            <GenerationStatus message={episode.generatingMessage} />
          ) : (
            playable.length > 0 && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <AudioLines className="h-3.5 w-3.5 text-accent" />
                {playable.length}{" "}
                {playable.length === 1 ? t("ws.chapter") : t("ws.chapters")}
              </p>
            )
          )}
        </div>
        <button
          type="button"
          aria-label={t("ws.deleteEpisode")}
          onClick={onDelete}
          className="self-start rounded p-1.5 text-faint hover:bg-muted hover:text-rose"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {playable.length > 0 && (
        <div className="border-t border-border bg-muted/40 px-5 py-3">
          <div className="space-y-2.5">
            {(expanded ? playable : playable.slice(0, 1)).map((segment, i) => (
              <div key={segment.id} className="space-y-1">
                <p className="text-[11px] font-medium text-muted-foreground">
                  <span className="mr-1.5 tabular-nums text-faint">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <MathText
                    text={
                      segment.title ||
                      t("ws.chapterN").replace("{n}", String(i + 1))
                    }
                  />
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
          {playable.length > 1 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 text-xs font-medium text-accent hover:text-accent-dim"
            >
              {expanded
                ? t("ws.showLess")
                : t("ws.showAllChapters").replace(
                    "{n}",
                    String(playable.length),
                  )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function WorkspaceRecallPage() {
  const params = useParams();
  const { t } = useI18n();
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
      query.state.data?.some((e) => e.generating) ? 3000 : false,
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
      toast.success(t("ws.podcastStarted"));
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
    onError: (err) => toastError(err, t("ws.podcastFailed")),
  });

  const remove = useMutation({
    mutationFn: deletePodcastEpisode,
    onSuccess: () => {
      toast.success(t("ws.episodeDeleted"));
      queryClient.invalidateQueries({
        queryKey: ["podcast-episodes", workspaceId],
      });
    },
    onError: (err) => toastError(err, t("ws.deleteFailed")),
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
      <div className="space-y-5 animate-fade-up">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">{t("ws.passiveRecall")}</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("ws.passiveRecallHint")}
            </p>
          </div>
          <Button size="sm" onClick={() => setShowChooser(true)}>
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            {t("ws.generatePodcast")}
          </Button>
        </div>

        {episodes.length === 0 ? (
          <EmptyScene image="/illustrations/icons/headphones.png">
            <p className="text-base font-semibold">{t("ws.noEpisodes")}</p>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {t("ws.noEpisodesHint")}
            </p>
            <Button
              size="sm"
              className="mt-4"
              onClick={() => setShowChooser(true)}
            >
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              {t("ws.generatePodcast")}
            </Button>
          </EmptyScene>
        ) : (
          <div className="space-y-3">
            {episodes.map((episode, i) => (
              <EpisodeCard
                key={episode.id}
                episode={episode}
                episodeNumber={episodes.length - i}
                onDelete={() => remove.mutate(episode.id)}
              />
            ))}
          </div>
        )}
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
              <h2 className="text-sm font-semibold">{t("ws.pickHost")}</h2>
              <button
                type="button"
                aria-label={t("ws.close")}
                onClick={() => setShowChooser(false)}
                className="rounded p-1 text-faint hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
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
                  : t("ws.loadingHosts")}
              </p>
              <Button
                size="sm"
                onClick={startGeneration}
                disabled={generate.isPending || !selectedCharacter}
              >
                {generate.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    {t("ws.starting")}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                    {t("ws.generatePodcastTokens")}
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
