"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchWorkspace } from "@/lib/api/workspace";
import { toast, toastError } from "@/lib/toast";
import {
  analyzeFiles,
  fetchFileDetails,
  reanalyzeFile,
  subscribeAnalysisProgress,
  uploadFiles,
  type AnalysisProgress,
} from "@/lib/api/materials";
import { Material, MaterialType } from "@/types";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { Card, Surface } from "@/components/ui/card";
import { ListRowsSkeleton, Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatRelativeDate } from "@/lib/utils";
import {
  Square,
  Circle,
  Upload,
  Sparkles,
  Check,
  Loader2,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Clock3,
  Image as ImageIcon,
  Layers,
  FileText,
} from "lucide-react";
import {
  PdfArt,
  NoteArt,
  AudioArt,
  SlidesArt,
  UploadArt,
} from "@/components/graphics/material-art";

const typeConfig: Record<
  MaterialType,
  { art: React.ElementType; label: string }
> = {
  note: { art: NoteArt, label: "Note" },
  pdf: { art: PdfArt, label: "PDF" },
  audio: { art: AudioArt, label: "Recording" },
  slides: { art: SlidesArt, label: "Slides" },
};

function formatAudioDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
}

function createSpeechRecognition(): SpeechRecognitionLike | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

function RecorderCard({
  onStop,
  onError,
}: {
  onStop: (seconds: number, blob: Blob | null) => void;
  onError: (msg: string) => void;
}) {
  const [seconds, setSeconds] = useState(0);
  const secondsRef = useRef(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [liveTranscript, setLiveTranscript] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    let tick: ReturnType<typeof setInterval>;
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        chunksRef.current = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.start(1000);
        tick = setInterval(() => {
          secondsRef.current += 1;
          setSeconds(secondsRef.current);
        }, 1000);

        // Live preview via the Web Speech API (Chrome); the authoritative
        // transcript still comes from server-side transcription on upload.
        const recognition = createSpeechRecognition();
        if (recognition) {
          recognitionRef.current = recognition;
          recognition.continuous = true;
          recognition.interimResults = true;
          let finals = "";
          recognition.onresult = (event) => {
            let interim = "";
            finals = "";
            for (let i = 0; i < event.results.length; i++) {
              const r = event.results[i];
              if (r.isFinal) finals += r[0].transcript;
              else interim += r[0].transcript;
            }
            setLiveTranscript((finals + interim).trim());
          };
          recognition.onend = () => {
            // Chrome stops recognition after silence; keep it running while
            // the recorder is active.
            if (mediaRecorderRef.current?.state === "recording") {
              try {
                recognition.start();
              } catch {
                /* already restarted */
              }
            }
          };
          try {
            recognition.start();
          } catch {
            recognitionRef.current = null;
          }
        }
      })
      .catch(() => onError("Microphone access denied"));
    return () => {
      clearInterval(tick);
      recognitionRef.current?.stop();
      mediaRecorderRef.current?.stream
        .getTracks()
        .forEach((t) => t.stop());
    };
  }, [onError]);

  return (
    <Card className="border-accent/25 bg-gradient-to-br from-accent-soft via-card to-card animate-fade-up">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-rose animate-pulse-dot" />
          </span>
          <span className="text-sm font-semibold">Recording</span>
          <span className="text-sm text-muted-foreground tabular-nums">
            {formatAudioDuration(seconds)}
          </span>
        </div>
        <Button
          size="sm"
          variant="danger"
          onClick={() => {
            const recorder = mediaRecorderRef.current;
            if (!recorder) {
              onStop(secondsRef.current, null);
              return;
            }
            recognitionRef.current?.stop();
            recorder.onstop = () => {
              const blob = new Blob(chunksRef.current, {
                type: recorder.mimeType || "audio/webm",
              });
              onStop(secondsRef.current, blob.size > 0 ? blob : null);
            };
            recorder.stop();
          }}
        >
          <Square className="h-3 w-3 mr-1.5 fill-current" />
          Stop
        </Button>
      </div>

      <div className="flex items-end gap-[3px] h-8 mt-4" aria-hidden>
        {Array.from({ length: 48 }).map((_, i) => (
          <span
            key={i}
            className="w-1 rounded-full bg-accent/60 animate-wave"
            style={{
              height: `${30 + ((i * 37) % 70)}%`,
              animationDelay: `${(i % 8) * 0.12}s`,
            }}
          />
        ))}
      </div>

      {liveTranscript && (
        <div className="mt-3 max-h-24 overflow-y-auto rounded-lg bg-muted/40 px-3 py-2">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {liveTranscript}
          </p>
          <p className="mt-1 text-[10px] text-faint">
            Live preview — the full transcript is generated after upload.
          </p>
        </div>
      )}
    </Card>
  );
}

const stepLabels: Record<string, string> = {
  fileUpload: "Uploading file",
  transcription: "Transcribing audio",
  parsing: "Parsing document",
  generation: "Generating study materials",
  worksheetBank: "Precomputing artifact bank",
  figureExtraction: "Extracting figures",
};

function analysisInFlight(progress: AnalysisProgress | null): boolean {
  if (!progress) return false;
  const steps = Object.values(progress.steps ?? {});
  return (
    steps.length > 0 &&
    steps.some((s) => s.status === "in_progress" || s.status === "pending")
  );
}

/** Per-file pipeline status derived from `file_analysis_progress` events. */
type FileAnalysisStatus = "queued" | "processing" | "completed" | "error";

/** Maps the persisted server-side status to the live badge status. */
function persistedFileStatus(
  material: Material,
): FileAnalysisStatus | undefined {
  switch (material.analysisStatus) {
    case "QUEUED":
      return "queued";
    case "ANALYZING":
      return "processing";
    case "FAILED":
      return "error";
    default:
      return undefined;
  }
}

function MaterialStatusBadge({
  material,
  analyzing,
  fileStatus,
}: {
  material: Material;
  analyzing: boolean;
  fileStatus?: FileAnalysisStatus;
}) {
  if (fileStatus === "queued") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[10px] font-semibold shrink-0">
        <Clock3 className="h-2.5 w-2.5" />
        Pending
      </span>
    );
  }
  if (fileStatus === "processing") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft text-accent-dim px-2 py-0.5 text-[10px] font-semibold shrink-0">
        <Loader2 className="h-2.5 w-2.5 animate-spin" />
        Analyzing...
      </span>
    );
  }
  if (fileStatus === "error") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose/10 text-rose px-2 py-0.5 text-[10px] font-semibold shrink-0">
        Analysis failed
      </span>
    );
  }
  if (material.analyzed) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-energy-soft text-accent-dim px-2 py-0.5 text-[10px] font-semibold shrink-0">
        <Check className="h-2.5 w-2.5" />
        Analyzed
      </span>
    );
  }
  if (analyzing) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft text-accent-dim px-2 py-0.5 text-[10px] font-semibold shrink-0">
        <Loader2 className="h-2.5 w-2.5 animate-spin" />
        Analyzing...
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[10px] font-semibold shrink-0">
      Not analyzed
    </span>
  );
}

function AnalysisStatusCard({ progress }: { progress: AnalysisProgress }) {
  const steps = Object.entries(progress.steps ?? {}).sort(
    (a, b) => a[1].order - b[1].order,
  );
  const done = steps.filter(
    ([, s]) => s.status === "completed" || s.status === "skipped",
  ).length;
  const allDone = steps.length > 0 && done === steps.length;

  if (allDone) {
    return (
      <div className="rounded-xl border border-accent/25 bg-accent-soft/50 px-3.5 py-2.5 animate-fade-up">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-accent-dim">
          <Sparkles className="h-3 w-3" />
          Analysis complete
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Artifact bank precomputed — Scribe feeds it into your study plans.
        </p>
      </div>
    );
  }

  return (
    <Surface muted className="px-3.5 py-3 space-y-2 animate-fade-up">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
          <span className="truncate">
            Analyzing {progress.currentFile ?? "materials"}...
          </span>
        </p>
        <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
          {done}/{steps.length} steps
        </span>
      </div>
      <div className="h-1 rounded-full bg-border overflow-hidden" aria-hidden>
        <div
          className="h-full rounded-full bg-accent transition-all duration-500"
          style={{ width: `${steps.length ? (done / steps.length) * 100 : 0}%` }}
        />
      </div>
      {steps
        .filter(([, s]) => s.status !== "skipped")
        .map(([key, step]) => (
          <p
            key={key}
            className="flex items-center gap-1.5 text-[11px] font-medium"
          >
            {step.status === "completed" ? (
              <Check className="h-3 w-3 text-accent" />
            ) : step.status === "in_progress" ? (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            ) : (
              <Circle className="h-2 w-2 text-faint" />
            )}
            <span
              className={
                step.status === "pending" ? "text-faint" : "text-muted-foreground"
              }
            >
              {stepLabels[key] ?? key}
            </span>
          </p>
        ))}
    </Surface>
  );
}

function FileDetailsPanel({
  workspaceId,
  fileId,
}: {
  workspaceId: string;
  fileId: string;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["fileDetails", workspaceId, fileId],
    queryFn: () => fetchFileDetails(workspaceId, fileId),
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4 text-xs text-muted-foreground">
        Could not load file details.
      </div>
    );
  }

  return (
    <div className="p-4 pt-0 space-y-4 border-t border-border mt-3">
      {/* Extracted images */}
      {data.images.length > 0 && (
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground mb-2">
            <ImageIcon className="h-3 w-3" />
            Extracted images ({data.images.length})
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {data.images.map((img, i) => (
              <div
                key={i}
                className="rounded-lg border border-border overflow-hidden bg-muted/30"
              >
                <img
                  src={img.url}
                  alt={img.description}
                  className="w-full h-24 object-cover"
                />
                <p className="px-2 py-1.5 text-[10px] text-muted-foreground line-clamp-2">
                  p.{img.page} — {img.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KB Chunks */}
      {data.chunks.length > 0 && (
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground mb-2">
            <Layers className="h-3 w-3" />
            Knowledge base chunks ({data.chunks.length})
          </p>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {data.chunks.map((chunk) => (
              <div
                key={chunk.index}
                className="rounded-lg border border-border bg-muted/30 px-3 py-2"
              >
                <span className="text-[10px] font-semibold text-faint">
                  Chunk {chunk.index + 1}
                </span>
                <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap line-clamp-4">
                  {chunk.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Raw text preview */}
      {data.textContent && data.chunks.length === 0 && (
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground mb-2">
            <FileText className="h-3 w-3" />
            Extracted text
          </p>
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 max-h-40 overflow-y-auto">
            <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-[12]">
              {data.textContent.slice(0, 2000)}
              {data.textContent.length > 2000 && "..."}
            </p>
          </div>
        </div>
      )}

      {/* No data state */}
      {!data.textContent && data.images.length === 0 && data.chunks.length === 0 && (
        <p className="text-xs text-faint">No parsed content available yet.</p>
      )}
    </div>
  );
}

export default function WorkspaceMaterialsPage() {
  const params = useParams();
  const workspaceId = params.id as string;
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: workspace, isLoading: workspaceLoading } = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => fetchWorkspace(workspaceId),
  });

  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);
  const [fileStatuses, setFileStatuses] = useState<
    Record<string, FileAnalysisStatus>
  >({});
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [reanalyzing, setReanalyzing] = useState<Set<string>>(new Set());

  const materials = workspace?.materials ?? [];
  const inFlight = analysisInFlight(progress);

  useEffect(
    () =>
      subscribeAnalysisProgress(workspaceId, (p) => {
        setProgress(p);
        if (p.fileId) {
          const status: FileAnalysisStatus =
            p.status === "queued"
              ? "queued"
              : p.status === "completed"
                ? "completed"
                : p.status === "error"
                  ? "error"
                  : "processing";
          setFileStatuses((prev) => ({ ...prev, [p.fileId!]: status }));
        }
        queryClient.invalidateQueries({ queryKey: ["workspace", workspaceId] });
      }),
    [workspaceId, queryClient],
  );

  const handleUpload = async (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    setUploadError(null);
    setUploading(true);
    try {
      const fileIds = await uploadFiles(workspaceId, Array.from(files));
      await analyzeFiles(workspaceId, fileIds);
      // Show a pending badge immediately; Pusher events take over from here.
      setFileStatuses((prev) => ({
        ...prev,
        ...Object.fromEntries(fileIds.map((id) => [id, "queued" as const])),
      }));
      queryClient.invalidateQueries({ queryKey: ["workspace", workspaceId] });
    } catch (err) {
      setUploadError(toastError(err, "Upload failed"));
    } finally {
      setUploading(false);
    }
  };

  const handleReanalyze = async (fileId: string) => {
    setReanalyzing((prev) => new Set(prev).add(fileId));
    try {
      await reanalyzeFile(workspaceId, fileId);
      queryClient.invalidateQueries({ queryKey: ["workspace", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["fileDetails", workspaceId, fileId] });
      toast.success("Re-analysis started");
    } catch (err) {
      toastError(err, "Failed to start re-analysis");
    } finally {
      setReanalyzing((prev) => {
        const next = new Set(prev);
        next.delete(fileId);
        return next;
      });
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const stopRecording = async (seconds: number, blob: Blob | null) => {
    setRecording(false);
    if (!blob) {
      setUploadError("Recording produced no audio");
      return;
    }
    const stamp = new Date().toISOString().slice(0, 16).replace("T", " ").replace(":", ".");
    const ext = blob.type.includes("ogg") ? "ogg" : blob.type.includes("mp4") ? "m4a" : "webm";
    const file = new File([blob], `Recording ${stamp} (${formatAudioDuration(seconds)}).${ext}`, {
      type: blob.type || "audio/webm",
    });
    await handleUpload([file]);
  };

  if (workspaceLoading) {
    return (
      <WorkspaceShell workspace={workspace} loading>
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2.5">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-8 w-32" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-4 w-28" />
            <ListRowsSkeleton count={4} />
          </div>
        </div>
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell workspace={workspace}>
      <div className="space-y-6">
        {/* Quick actions */}
        <div className="flex flex-wrap gap-2.5 animate-fade-up">
          <Button
            size="sm"
            onClick={() => setRecording(true)}
            disabled={recording}
          >
            <Circle className="h-3 w-3 mr-1.5 fill-rose text-rose" />
            Record audio
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5 mr-1.5" />
            )}
            {uploading ? "Uploading..." : "Upload files"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.ppt,.pptx,.key,audio/*"
            className="hidden"
            onChange={(e) => {
              void handleUpload(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {uploadError && (
          <p className="text-xs text-rose animate-fade-up">{uploadError}</p>
        )}

        {progress && !!progress.steps && (
          <AnalysisStatusCard progress={progress} />
        )}

        {recording && (
          <RecorderCard
            onStop={stopRecording}
            onError={(message) => {
              setRecording(false);
              setUploadError(message);
            }}
          />
        )}

        {/* Materials list */}
        <section className="animate-fade-up">
          <h2 className="text-sm font-semibold text-foreground mb-4">
            All materials
          </h2>

          {materials.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border-strong bg-card text-center py-14 px-6">
              <UploadArt className="h-12 w-12 mx-auto mb-3" />
              <p className="text-sm font-semibold">Nothing here yet</p>
              <p className="text-xs text-muted-foreground mt-1.5 max-w-sm mx-auto">
                Add notes, record lectures, or upload PDFs and slides — Scribe
                uses them to build your study sessions.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {materials.map((material) => {
                const config = typeConfig[material.type];
                const Art = config.art;
                const expanded = expandedFiles.has(material.id);
                const isReanalyzing = reanalyzing.has(material.id);
                return (
                  <Card
                    key={material.id}
                    className="p-0 overflow-hidden"
                  >
                    {/* Header row — clickable to expand */}
                    <div
                      className="flex items-start gap-4 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => toggleExpanded(material.id)}
                    >
                      <Art className="h-10 w-10 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold truncate">
                            {material.title}
                          </h3>
                          <span className="text-[11px] text-faint shrink-0">
                            {config.label}
                          </span>
                          <MaterialStatusBadge
                            material={material}
                            analyzing={
                              (!material.analyzed && inFlight) || isReanalyzing
                            }
                            fileStatus={
                              fileStatuses[material.id] ??
                              persistedFileStatus(material)
                            }
                          />
                        </div>
                        {material.preview && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {material.preview}
                          </p>
                        )}
                        <p className="text-[11px] text-faint mt-1.5">
                          {material.pages && `${material.pages} pages \u00b7 `}
                          {material.durationSeconds !== undefined &&
                            `${formatAudioDuration(material.durationSeconds)} \u00b7 `}
                          {material.sizeLabel && `${material.sizeLabel} \u00b7 `}
                          {formatRelativeDate(material.updatedAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          title="Re-analyse"
                          disabled={isReanalyzing}
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleReanalyze(material.id);
                          }}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                        >
                          <RefreshCw
                            className={`h-3.5 w-3.5 ${isReanalyzing ? "animate-spin" : ""}`}
                          />
                        </button>
                        {expanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {/* Expanded details */}
                    {expanded && (
                      <FileDetailsPanel
                        workspaceId={workspaceId}
                        fileId={material.id}
                      />
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </WorkspaceShell>
  );
}
