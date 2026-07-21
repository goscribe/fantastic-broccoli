import { api } from "./trpc-client";

/**
 * Data layer for Passive Recall (podcast episodes) and the workspace study
 * guide, backed by the server's `podcast` and `studyguide` tRPC routers.
 */

export interface PodcastSegment {
  id: string;
  title: string | null;
  audioUrl: string | null;
  startTime: number | null;
  duration: number | null;
  order: number;
}

export interface PodcastEpisode {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  segments: PodcastSegment[];
  createdAt: string | Date;
  generating: boolean;
}

export interface PodcastVoice {
  id: string;
  name: string;
  description: string;
}

interface EpisodeRow {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  segments: {
    id: string;
    title: string | null;
    audioUrl: string | null;
    startTime: number | null;
    duration: number | null;
    order: number;
  }[];
  createdAt: string | Date;
  generating: boolean;
}

export async function fetchPodcastEpisodes(
  workspaceId: string,
): Promise<PodcastEpisode[]> {
  const rows = (await api.podcast.listEpisodes.query({
    workspaceId,
  })) as unknown as EpisodeRow[];
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    imageUrl: row.imageUrl,
    segments: [...row.segments].sort((a, b) => a.order - b.order),
    createdAt: row.createdAt,
    generating: row.generating,
  }));
}

export async function fetchPodcastVoices(): Promise<PodcastVoice[]> {
  return (await api.podcast.getAvailableVoices.query()) as PodcastVoice[];
}

export async function generatePodcastEpisode(input: {
  workspaceId: string;
  title?: string;
  userPrompt?: string;
  hostVoiceId: string;
  guestVoiceId?: string;
}): Promise<void> {
  const speakers: { id: string; role: "host" | "guest" }[] = [
    { id: input.hostVoiceId, role: "host" },
    ...(input.guestVoiceId
      ? [{ id: input.guestVoiceId, role: "guest" as const }]
      : []),
  ];
  await api.podcast.generateEpisode.mutate({
    workspaceId: input.workspaceId,
    podcastData: {
      title: input.title?.trim() || undefined,
      userPrompt: input.userPrompt?.trim() || undefined,
      speakers,
      speed: 1.0,
      generateIntro: true,
      generateOutro: true,
      segmentByTopics: true,
    },
  });
}

export async function deletePodcastEpisode(episodeId: string): Promise<void> {
  await api.podcast.deleteEpisode.mutate({ episodeId });
}

// ---------- study guide ----------

export interface StudyGuide {
  artifactId: string;
  title: string;
  content: string | null;
}

export async function fetchStudyGuide(
  workspaceId: string,
): Promise<StudyGuide> {
  const result = (await api.studyguide.get.query({
    workspaceId,
  })) as unknown as {
    artifactId: string;
    title: string;
    latestVersion: { content: string | null } | null;
  };
  return {
    artifactId: result.artifactId,
    title: result.title,
    content: result.latestVersion?.content ?? null,
  };
}
