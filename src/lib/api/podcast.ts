import { api } from "./trpc-client";
import { rpc } from "./study-session";

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
  topic: string | null;
  content: string | null;
}

interface GuideRow {
  artifactId: string;
  title: string;
  topic?: string | null;
  latestVersion: { content: string | null } | null;
}

function toGuide(row: GuideRow): StudyGuide {
  return {
    artifactId: row.artifactId,
    title: row.title,
    topic: row.topic ?? null,
    content: row.latestVersion?.content ?? null,
  };
}

export async function fetchStudyGuides(
  workspaceId: string,
): Promise<StudyGuide[]> {
  try {
    // `studyguide.list` is newer than the published @goscribe/server types.
    const rows = await rpc<GuideRow[]>("studyguide.list", "query", {
      workspaceId,
    });
    return rows.map(toGuide);
  } catch {
    // Older servers only expose studyguide.get — fall back to a single guide.
    return [await fetchStudyGuide(workspaceId)];
  }
}

export async function fetchStudyGuide(
  workspaceId: string,
): Promise<StudyGuide> {
  const result = (await api.studyguide.get.query({
    workspaceId,
  })) as unknown as GuideRow;
  return toGuide(result);
}
