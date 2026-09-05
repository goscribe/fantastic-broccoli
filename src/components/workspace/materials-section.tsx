"use client";

import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast, toastError } from "@/lib/toast";
import {
  analyzeFiles,
  deleteFiles,
  reanalyzeFile,
  subscribeAnalysisProgress,
  uploadFiles,
  type AnalysisProgress,
} from "@/lib/api/materials";
import { Material, MaterialType } from "@/types";
import { notifyFirstFileUploaded } from "@/components/onboarding/guided-tour";
import { Card, Surface } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatRelativeDate } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/workspace";
import { UPLOAD_ACCEPT } from "@/lib/uploads";
import {
  Square,
  Circle,
  Upload,
  Sparkles,
  Check,
  Loader2,
  RefreshCw,
  Clock3,
  Camera,
  Trash2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  PdfArt,
  NoteArt,
  AudioArt,
  SlidesArt,
} from "@/components/graphics/material-art";

const typeConfig: Record<
  MaterialType,
  { art: React.ElementType; labelKey: string }
> = {
  note: { art: NoteArt, labelKey: "ws.type.note" },
  pdf: { art: PdfArt, labelKey: "ws.type.pdf" },
  audio: { art: AudioArt, labelKey: "ws.type.audio" },
  slides: { art: SlidesArt, labelKey: "ws.type.slides" },
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
  const { t } = useI18n();
  const [seconds, setSeconds] = useState(0);
  const secondsRef = useRef(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [liveTranscript, setLiveTranscript] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    let tick: ReturnType<typeof setInterval>;
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        if (cancelled || mediaRecorderRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        const chunks: Blob[] = [];
        chunksRef.current = chunks;
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
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
      .catch(() => onError(t("ws.micDenied")));
    return () => {
      cancelled = true;
      clearInterval(tick);
      recognitionRef.current?.stop();
      const recorder = mediaRecorderRef.current;
      if (recorder) {
        if (recorder.state !== "inactive") recorder.stop();
        recorder.stream.getTracks().forEach((t) => t.stop());
        mediaRecorderRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onError]);

  return (
    <Card className="border-accent/25 bg-gradient-to-br from-accent-soft via-card to-card animate-fade-up">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-rose animate-pulse-dot" />
          </span>
          <span className="text-sm font-semibold">
            {t("ws.recordingLabel")}
          </span>
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
          {t("ws.stop")}
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
            {t("ws.livePreviewNote")}
          </p>
        </div>
      )}
    </Card>
  );
}

const stepLabelKeys: Record<string, string> = {
  fileUpload: "ws.step.fileUpload",
  transcription: "ws.step.transcription",
  parsing: "ws.step.parsing",
  generation: "ws.step.generation",
  worksheetBank: "ws.step.worksheetBank",
  figureExtraction: "ws.step.figureExtraction",
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
type FileAnalysisStatus =
  | "queued"
  | "processing"
  | "completed"
  | "deferred"
  | "error";

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
    case "NOT_ANALYZED":
      // Deferred by a provider capacity error; the server retries it.
      return material.analysisError ? "deferred" : undefined;
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
  const { t } = useI18n();
  if (fileStatus === "queued") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[10px] font-semibold shrink-0">
        <Clock3 className="h-2.5 w-2.5" />
        {t("ws.pendingBadge")}
      </span>
    );
  }
  if (fileStatus === "processing") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft text-accent-dim px-2 py-0.5 text-[10px] font-semibold shrink-0">
        <Loader2 className="h-2.5 w-2.5 animate-spin" />
        {t("ws.analyzing")}
      </span>
    );
  }
  if (fileStatus === "deferred") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[10px] font-semibold shrink-0">
        <Clock3 className="h-2.5 w-2.5" />
        {t("ws.analysisDeferred")}
      </span>
    );
  }
  if (fileStatus === "error") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose/10 text-rose px-2 py-0.5 text-[10px] font-semibold shrink-0">
        {t("ws.analysisFailed")}
      </span>
    );
  }
  if (material.analyzed) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-energy-soft text-accent-dim px-2 py-0.5 text-[10px] font-semibold shrink-0">
        <Check className="h-2.5 w-2.5" />
        {t("ws.analyzed")}
      </span>
    );
  }
  if (analyzing) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft text-accent-dim px-2 py-0.5 text-[10px] font-semibold shrink-0">
        <Loader2 className="h-2.5 w-2.5 animate-spin" />
        {t("ws.analyzing")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[10px] font-semibold shrink-0">
      {t("ws.notAnalyzed")}
    </span>
  );
}

function AnalysisStatusCard({ progress }: { progress: AnalysisProgress }) {
  const { t } = useI18n();
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
          {t("ws.analysisComplete")}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {t("ws.analysisCompleteHint")}
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
            {t("ws.analyzingItem").replace(
              "{name}",
              progress.currentFile ?? t("ws.materialsWord"),
            )}
          </span>
        </p>
        <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
          {done}/{steps.length} {t("ws.steps")}
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
              {stepLabelKeys[key] ? t(stepLabelKeys[key]) : key}
            </span>
          </p>
        ))}
    </Surface>
  );
}

/**
 * Compact materials manager: upload/record/scan actions, live analysis
 * progress, and a small row per material (no content previews).
 */
export function MaterialsSection({
  workspaceId,
  materials,
}: {
  workspaceId: string;
  materials: Material[];
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);
  const [fileStatuses, setFileStatuses] = useState<
    Record<string, FileAnalysisStatus>
  >({});
  const [reanalyzing, setReanalyzing] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);

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
                  : p.status === "deferred"
                    ? "deferred"
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
      const isFirstFile = materials.length === 0;
      const fileIds = await uploadFiles(workspaceId, Array.from(files));
      await analyzeFiles(workspaceId, fileIds);
      if (isFirstFile) notifyFirstFileUploaded();
      // Show a pending badge immediately; Pusher events take over from here.
      setFileStatuses((prev) => ({
        ...prev,
        ...Object.fromEntries(fileIds.map((id) => [id, "queued" as const])),
      }));
      queryClient.invalidateQueries({ queryKey: ["workspace", workspaceId] });
    } catch (err) {
      setUploadError(toastError(err, t("ws.uploadFailed")));
    } finally {
      setUploading(false);
    }
  };

  const handleReanalyze = async (fileId: string) => {
    setReanalyzing((prev) => new Set(prev).add(fileId));
    try {
      await reanalyzeFile(workspaceId, fileId);
      queryClient.invalidateQueries({ queryKey: ["workspace", workspaceId] });
      toast.success(t("ws.reanalysisStarted"));
    } catch (err) {
      toastError(err, t("ws.reanalysisFailed"));
    } finally {
      setReanalyzing((prev) => {
        const next = new Set(prev);
        next.delete(fileId);
        return next;
      });
    }
  };

  const handleDelete = async (material: Material) => {
    if (!confirm(t("ws.confirmDeleteMaterial").replace("{name}", material.title)))
      return;
    setDeleting((prev) => new Set(prev).add(material.id));
    try {
      await deleteFiles(workspaceId, [material.id]);
      queryClient.invalidateQueries({ queryKey: ["workspace", workspaceId] });
      toast.success(t("ws.materialDeleted"));
    } catch (err) {
      toastError(err, t("ws.materialDeleteFailed"));
    } finally {
      setDeleting((prev) => {
        const next = new Set(prev);
        next.delete(material.id);
        return next;
      });
    }
  };

  const stopRecording = async (seconds: number, blob: Blob | null) => {
    setRecording(false);
    if (!blob) {
      setUploadError(t("ws.recordingNoAudio"));
      return;
    }
    const stamp = new Date().toISOString().slice(0, 16).replace("T", " ").replace(":", ".");
    const ext = blob.type.includes("ogg") ? "ogg" : blob.type.includes("mp4") ? "m4a" : "webm";
    const file = new File([blob], `Recording ${stamp} (${formatAudioDuration(seconds)}).${ext}`, {
      type: blob.type || "audio/webm",
    });
    await handleUpload([file]);
  };

  return (
    <section className="animate-fade-up space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 text-sm font-semibold text-foreground"
        >
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          {t("ws.materials")}
          {materials.length > 0 && (
            <span className="text-xs font-medium text-faint">
              {materials.length}
            </span>
          )}
        </button>
        <div
          className="flex flex-wrap gap-2"
          data-tour="upload-materials"
        >
          <Button
            size="sm"
            variant="outline"
            onClick={() => setRecording(true)}
            disabled={recording}
          >
            <Circle className="h-3 w-3 mr-1.5 fill-rose text-rose" />
            {t("ws.record")}
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
            {uploading ? t("ws.uploading") : t("ws.upload")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="sm:hidden"
            onClick={() => cameraInputRef.current?.click()}
            disabled={uploading}
          >
            <Camera className="h-3.5 w-3.5 mr-1.5" />
            {t("ws.scan")}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={UPLOAD_ACCEPT}
            className="hidden"
            onChange={(e) => {
              void handleUpload(e.target.files);
              e.target.value = "";
            }}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              void handleUpload(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {uploadError && (
        <p className="text-xs text-rose animate-fade-up">{uploadError}</p>
      )}

      {progress && !!progress.steps && (
        <div data-tour="analysis-status">
          <AnalysisStatusCard progress={progress} />
        </div>
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

      {!open ? null : materials.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-strong bg-card text-center py-8 px-6">
          <p className="text-sm font-semibold">{t("ws.noMaterialsYet")}</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            {t("ws.noMaterialsHint")}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
          {materials.map((material) => {
            const config = typeConfig[material.type];
            const Art = config.art;
            const isReanalyzing = reanalyzing.has(material.id);
            const isDeleting = deleting.has(material.id);
            return (
              <div
                key={material.id}
                className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-muted/30 transition-colors"
              >
                <Art className="h-7 w-7 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[13px] font-semibold truncate">
                      {material.title}
                    </h3>
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
                  <p className="text-[11px] text-faint mt-0.5 truncate">
                    {t(config.labelKey)}
                    {material.pages
                      ? ` \u00b7 ${material.pages} ${t("ws.pages")}`
                      : ""}
                    {material.durationSeconds !== undefined
                      ? ` \u00b7 ${formatAudioDuration(material.durationSeconds)}`
                      : ""}
                    {material.sizeLabel ? ` \u00b7 ${material.sizeLabel}` : ""}
                    {` \u00b7 ${formatRelativeDate(material.updatedAt)}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    title={t("ws.reanalyse")}
                    disabled={isReanalyzing}
                    onClick={() => void handleReanalyze(material.id)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${isReanalyzing ? "animate-spin" : ""}`}
                    />
                  </button>
                  <button
                    type="button"
                    title={t("ws.delete")}
                    disabled={isDeleting}
                    onClick={() => void handleDelete(material)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-rose hover:bg-rose/10 transition-colors disabled:opacity-50"
                  >
                    {isDeleting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
