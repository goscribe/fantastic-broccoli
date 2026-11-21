"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { SubjectPage } from "@/components/learn/subject-page";
import { FullScreenLoader } from "@/components/layout/full-screen-loader";
import { useNewUi } from "@/lib/new-ui";

/** New UI: the subject page. Old UI: straight to the chat tab as before. */
export default function WorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const newUi = useNewUi();

  useEffect(() => {
    if (!newUi) router.replace(`/workspace/${id}/chat`);
  }, [newUi, id, router]);

  if (!newUi) return <FullScreenLoader />;
  return <SubjectPage workspaceId={id} />;
}
