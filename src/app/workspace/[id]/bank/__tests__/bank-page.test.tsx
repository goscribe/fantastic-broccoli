import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import WorkspaceBankPage from "../page";

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <WorkspaceBankPage />
    </QueryClientProvider>,
  );
}

test("bank page lists artifact bank items from studySession.listBank", async () => {
  renderPage();

  expect(
    await screen.findByText("Halogenoalkane hydrolysis — exam set"),
  ).toBeInTheDocument();
  expect(screen.getByText("Substitution mechanisms deck")).toBeInTheDocument();
});

test("bank page renders workspace tabs once workspace.get resolves", async () => {
  renderPage();

  expect(await screen.findByText("Materials")).toBeInTheDocument();
  expect(screen.getByText("Study")).toBeInTheDocument();
  expect(screen.getByText("Bank")).toBeInTheDocument();
});
