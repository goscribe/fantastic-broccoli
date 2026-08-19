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
  /** Server-reported stage of an in-flight generation, e.g. "Generating audio for \"X\" (2 of 5)..." */
  generatingMessage: string | null;
}

export interface PodcastVoice {
  id: string;
  name: string;
  description: string;
}

export interface PodcastCharacter {
  id: string;
  name: string;
  voiceId: string;
  tagline: string;
  imageUrl: string | null;
  persona?: string;
}

/** Local presets mirrored from the server, used when the deployed server
 * doesn't expose `podcast.getCharacters` yet. */
const FALLBACK_CHARACTERS: PodcastCharacter[] = [
  {
    id: "professor-sage",
    name: "Professor Sage",
    voiceId: "JBFqnCBsd6RMkjVDRZzb",
    tagline: "Deep-dive lecturer",
    imageUrl: null,
  },
  {
    id: "nova-spark",
    name: "Nova",
    voiceId: "21m00Tcm4TlvDq8ikWAM",
    tagline: "Upbeat study buddy",
    imageUrl: null,
  },
  {
    id: "captain-recall",
    name: "Captain Recall",
    voiceId: "pNInz6obpnDX6XkjA0LD",
    tagline: "Quiz-master drills",
    imageUrl: null,
  },
  {
    id: "luna-fable",
    name: "Luna",
    voiceId: "pFZP5JQG7iQjIQuC4Bku",
    tagline: "Storyteller",
    imageUrl: null,
  },
  {
    id: "dr-atlas",
    name: "Dr. Atlas",
    voiceId: "ErXwobaYiN019PkySvjV",
    tagline: "Structured explainer",
    imageUrl: null,
  },
  {
    id: "ziggy-volt",
    name: "Ziggy",
    voiceId: "IKne3meq5aSn9XLyUdCD",
    tagline: "High-energy hype",
    imageUrl: null,
  },
];

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
  generatingMetadata?: { message?: string } | null;
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
    generatingMessage: row.generatingMetadata?.message ?? null,
  }));
}

export async function fetchPodcastVoices(): Promise<PodcastVoice[]> {
  return (await api.podcast.getAvailableVoices.query()) as PodcastVoice[];
}

export async function fetchPodcastCharacters(): Promise<PodcastCharacter[]> {
  try {
    // `podcast.getCharacters` is newer than the published @goscribe/server types.
    return await rpc<PodcastCharacter[]>(
      "podcast.getCharacters",
      "query",
      undefined,
    );
  } catch {
    return FALLBACK_CHARACTERS;
  }
}

export async function generatePodcastEpisode(input: {
  workspaceId: string;
  character: PodcastCharacter;
}): Promise<void> {
  await api.podcast.generateEpisode.mutate({
    workspaceId: input.workspaceId,
    podcastData: {
      speakers: [
        {
          id: input.character.voiceId,
          role: "host",
          name: input.character.name,
          ...(input.character.persona
            ? { persona: input.character.persona }
            : {}),
        },
      ],
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

export async function deleteStudyGuide(
  workspaceId: string,
  artifactId: string,
): Promise<void> {
  // `studyguide.delete` is newer than the published @goscribe/server types.
  await rpc("studyguide.delete", "mutation", { workspaceId, artifactId });
}

export async function regenerateStudyGuides(
  workspaceId: string,
  artifactId?: string,
): Promise<{ started: boolean; count: number }> {
  // `studyguide.regenerate` is newer than the published @goscribe/server types.
  return rpc<{ started: boolean; count: number }>(
    "studyguide.regenerate",
    "mutation",
    { workspaceId, ...(artifactId ? { artifactId } : {}) },
  );
}

export async function fetchStudyGuide(
  workspaceId: string,
): Promise<StudyGuide> {
  const result = (await api.studyguide.get.query({
    workspaceId,
  })) as unknown as GuideRow;
  return toGuide(result);
}
