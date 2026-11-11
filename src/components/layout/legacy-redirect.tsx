"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { FullScreenLoader } from "@/components/layout/full-screen-loader";
import { useNewUi } from "@/lib/new-ui";

/** Old workspace sub-pages: under the new UI they collapse into the scoped Learn page. */
export function LegacyPage({ to, children }: { to: string; children: React.ReactNode }) {
  const newUi = useNewUi();
  const router = useRouter();
  useEffect(() => {
    if (newUi) router.replace(to);
  }, [newUi, to, router]);
  if (newUi) return <FullScreenLoader />;
  return <>{children}</>;
}
