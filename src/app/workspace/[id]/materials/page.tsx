import { redirect } from "next/navigation";

// Materials now live on the combined Study tab.
export default async function WorkspaceMaterialsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/workspace/${id}/study`);
}
