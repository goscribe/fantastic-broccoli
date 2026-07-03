"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getWorkspace } from "@/lib/mock-data";
import { Material, MaterialType } from "@/types";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatRelativeDate } from "@/lib/utils";
import {
  Plus,
  Square,
  Circle,
  Upload,
  Sparkles,
  Check,
  Loader2,
  ArrowRight,
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

const transcriptScript = [
  "…okay so today we're covering ionization energy trends…",
  "remember, first ionization energy is the energy to remove one mole of electrons…",
  "…from one mole of gaseous atoms in their ground state.",
  "Notice the dip between magnesium and aluminium — that's the 3p electron…",
];

function formatAudioDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function RecorderCard({ onStop }: { onStop: (seconds: number) => void }) {
  const [seconds, setSeconds] = useState(0);
  const [lines, setLines] = useState<string[]>([]);
  const secondsRef = useRef(0);

  useEffect(() => {
    const tick = setInterval(() => {
      secondsRef.current += 1;
      setSeconds(secondsRef.current);
      if (
        secondsRef.current % 3 === 0 &&
        secondsRef.current / 3 <= transcriptScript.length
      ) {
        setLines(transcriptScript.slice(0, secondsRef.current / 3));
      }
    }, 1000);
    return () => clearInterval(tick);
  }, []);

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
          onClick={() => onStop(secondsRef.current)}
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

      <div className="mt-4 rounded-xl bg-card border border-border p-4">
        <p className="text-xs font-semibold text-muted-foreground mb-2">
          Live transcription
        </p>
        {lines.length === 0 ? (
          <p className="text-sm text-faint">Listening…</p>
        ) : (
          <div className="space-y-1.5">
            {lines.map((line) => (
              <p key={line} className="text-sm animate-fade-up">
                {line}
              </p>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

const convertStages = [
  "Reading PDF…",
  "Extracting diagrams — 3 figures captured",
  "Writing multi-step questions with sub-parts",
  "Worksheet ready",
];

function ConvertToWorksheet({
  material,
  workspaceId,
}: {
  material: Material;
  workspaceId: string;
}) {
  const [stage, setStage] = useState(-1);

  useEffect(() => {
    if (stage < 0 || stage >= convertStages.length - 1) return;
    const t = setTimeout(() => setStage((s) => s + 1), 1200);
    return () => clearTimeout(t);
  }, [stage]);

  if (stage === -1) {
    return (
      <Button
        size="sm"
        variant="outline"
        className="shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          setStage(0);
        }}
      >
        <Sparkles className="h-3.5 w-3.5 mr-1.5 text-accent" />
        Convert to worksheet
      </Button>
    );
  }

  const done = stage === convertStages.length - 1;
  return (
    <div
      className="shrink-0 w-64 rounded-xl border border-border bg-muted/40 px-3.5 py-2.5 space-y-1.5"
      onClick={(e) => e.stopPropagation()}
    >
      {convertStages.slice(0, stage + 1).map((label, i) => (
        <p
          key={label}
          className="flex items-center gap-1.5 text-[11px] font-medium animate-fade-up"
        >
          {i < stage || done ? (
            <Check className="h-3 w-3 text-accent" />
          ) : (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          )}
          <span className={i === stage && !done ? "text-muted-foreground" : ""}>
            {label}
          </span>
        </p>
      ))}
      {done && (
        <Link
          href={`/workspace/${workspaceId}/session/ses-1`}
          className="flex items-center gap-1 text-[11px] font-semibold text-accent-dim hover:underline pt-0.5"
        >
          Open “Structured Worksheet — {(material.title.split(" \u2014 ")[1] ?? material.title).replace(/\.pdf$/i, "")}”
          <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

export default function WorkspaceMaterialsPage() {
  const params = useParams();
  const workspaceId = params.id as string;
  const workspace = getWorkspace(workspaceId);

  const [recording, setRecording] = useState(false);
  const [materials, setMaterials] = useState<Material[]>(
    workspace?.materials ?? [],
  );

  const stopRecording = (seconds: number) => {
    setRecording(false);
    setMaterials((prev) => [
      {
        id: `mat-new-${Date.now()}`,
        workspaceId,
        type: "audio",
        title: "New recording",
        durationSeconds: seconds,
        preview: transcriptScript.join(" "),
        updatedAt: new Date().toISOString(),
      },
      ...prev,
    ]);
  };

  return (
    <WorkspaceShell workspace={workspace}>
      <div className="space-y-6">
        {/* Quick actions */}
        <div className="flex flex-wrap gap-2.5 animate-fade-up">
          <Button size="sm">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New note
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setRecording(true)}
            disabled={recording}
          >
            <Circle className="h-3 w-3 mr-1.5 fill-rose text-rose" />
            Record audio
          </Button>
          <Button size="sm" variant="outline">
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            Upload files
          </Button>
        </div>

        {recording && <RecorderCard onStop={stopRecording} />}

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
                return (
                  <Card
                    key={material.id}
                    interactive
                    className="flex items-start gap-4 p-4"
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
                      </div>
                      {material.preview && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {material.preview}
                        </p>
                      )}
                      <p className="text-[11px] text-faint mt-1.5">
                        {material.pages && `${material.pages} pages · `}
                        {material.durationSeconds !== undefined &&
                          `${formatAudioDuration(material.durationSeconds)} · `}
                        {material.sizeLabel && `${material.sizeLabel} · `}
                        {formatRelativeDate(material.updatedAt)}
                      </p>
                    </div>
                    {(material.type === "pdf" || material.type === "slides") && (
                      <ConvertToWorksheet
                        material={material}
                        workspaceId={workspaceId}
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
