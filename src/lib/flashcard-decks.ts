"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchWorkspaceTree } from "@/lib/api/workspace";
import {
  studySessionApi,
  type ApiArtifactBankItem,
} from "@/lib/api/study-session";
import { deckEntries } from "@/components/bank/bank-content";
import { Folder as FolderType, Workspace } from "@/types";

export interface DeckWithWorkspace {
  item: ApiArtifactBankItem;
  workspace: Workspace;
  cardCount: number;
}

function flattenWorkspaces(
  folders: FolderType[],
  rootWorkspaces: Workspace[],
): Workspace[] {
  const all: Workspace[] = [...rootWorkspaces];
  const walk = (folder: FolderType) => {
    all.push(...folder.workspaces);
    folder.folders?.forEach(walk);
  };
  folders.forEach(walk);
  return all;
}

export function useFlashcardDecks() {
  return useQuery({
    queryKey: ["flashcard-decks"],
    queryFn: async (): Promise<DeckWithWorkspace[]> => {
      const tree = await fetchWorkspaceTree();
      const workspaces = flattenWorkspaces(tree.folders, tree.rootWorkspaces);
      const perWorkspace = await Promise.all(
        workspaces.map(async (workspace) => {
          try {
            const items = await studySessionApi.listBank({
              workspaceId: workspace.id,
            });
            return items
              .filter(
                (item) =>
                  item.kind === "FLASHCARD_DECK" || item.kind === "VOCAB_DECK",
              )
              .map((item) => ({
                item,
                workspace,
                cardCount: deckEntries(item)?.entries.length ?? 0,
              }));
          } catch {
            return [];
          }
        }),
      );
      return perWorkspace.flat();
    },
  });
}
