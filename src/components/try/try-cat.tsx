import Image from "next/image";
import { cn } from "@/lib/utils";

export type TryCatPose = "wave" | "cheer" | "pencil" | "book" | "think" | "trophy" | "sleep";

/**
 * The cat for signed-out screens: the same pose art as <Mascot>, as a plain
 * image. <Mascot> reads the student's shop outfit from the API, which a
 * visitor without an account can't call.
 */
export function TryCat({ pose, className, priority }: { pose: TryCatPose; className?: string; priority?: boolean }) {
  return (
    <Image
      src={`/design/cat3-${pose}.webp`}
      alt=""
      width={400}
      height={400}
      unoptimized
      priority={priority}
      draggable={false}
      className={cn("w-auto shrink-0 select-none object-contain", className)}
    />
  );
}
