import { AppFrame } from "@/components/design/shell";
import { Generating } from "@/components/design/generating";

/** In-app generation screen: /design/loading?step=0..4 */
export default async function LoadingPreview({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  const { step = "1" } = await searchParams;
  const index = Math.max(0, Math.min(4, Number(step) || 0));
  return (
    <AppFrame active="Learn">
      <div className="mx-auto flex w-full max-w-[880px] flex-col items-center gap-6 px-8 pb-12 pt-10">
        <div className="w-full max-w-[560px] rounded-3xl border border-border bg-white px-8 py-8">
          <Generating index={index} title="Osmosis & water potential" />
          {index >= 4 && <div className="mt-5 flex justify-center gap-2.5"><span className="inline-flex h-11 items-center rounded-xl bg-accent px-6 text-[14px] font-semibold text-white">Start session</span><span className="inline-flex h-11 items-center rounded-xl border border-border px-5 text-[14px] font-semibold">See plan</span></div>}
        </div>
        {index < 4 && <button className="text-[13px] font-semibold text-accent">Answer a warm-up question while you wait</button>}
      </div>
    </AppFrame>
  );
}
