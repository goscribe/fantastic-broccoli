import { redirect } from "next/navigation";

// Materials live on the workspace Learn page.
export default async function WorkspaceMaterialsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/workspace/${id}`);
}
