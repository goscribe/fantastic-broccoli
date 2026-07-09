import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import HomePage from "../page";

test("home page renders folders and root workspaces from workspace.getTree", async () => {
  render(<HomePage />);

  expect(await screen.findByText("Sciences")).toBeInTheDocument();
  expect(screen.getByText("Humanities")).toBeInTheDocument();
  expect(await screen.findByText("Calculus II")).toBeInTheDocument();
});

test("home page greets the authenticated user from auth.getSession", async () => {
  render(<HomePage />);

  expect(await screen.findByText(/Maya/)).toBeInTheDocument();
});
