import { AppFrame } from "@/components/design/shell";
import { BuildBar, WarmupCard } from "@/components/design/generating";

/** In-app generation screen: /design/loading?step=0..4 — warm-up first, build status as a slim bar. */
export default async function LoadingPreview({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  const { step = "1" } = await searchParams;
  const index = Math.max(0, Math.min(4, Number(step) || 0));
  return (
    <AppFrame active="Learn">
      <div className="mx-auto flex w-full max-w-[640px] flex-col items-center gap-5 px-8 pb-12 pt-8">
        <BuildBar index={index} title="Osmosis & water potential" />
        <WarmupCard hero />
        <p className="text-[13px] text-faint">{index >= 4 ? "Finish this one or jump straight in." : "We’ll tell you the moment it’s ready."}</p>
      </div>
    </AppFrame>
  );
}
