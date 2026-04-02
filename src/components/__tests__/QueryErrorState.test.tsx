import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryErrorState } from "../QueryErrorState";

describe("QueryErrorState", () => {
  it("renders title and error message", () => {
    render(
      <QueryErrorState error={new Error("Server timeout")} title="Load failed" />
    );
    expect(screen.getByText("Load failed")).toBeInTheDocument();
    expect(screen.getByText("Server timeout")).toBeInTheDocument();
  });

  it("shows retry button when onRetry provided", () => {
    const onRetry = vi.fn();
    render(
      <QueryErrorState error={new Error("fail")} onRetry={onRetry} />
    );
    const btn = screen.getByRole("button", { name: /try again/i });
    fireEvent.click(btn);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("hides retry button when no onRetry", () => {
    render(<QueryErrorState error={new Error("fail")} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows network-specific messaging for fetch errors", () => {
    render(
      <QueryErrorState error={new Error("Failed to fetch")} />
    );
    expect(screen.getByText(/internet connection/i)).toBeInTheDocument();
  });

  it("renders compact variant", () => {
    const onRetry = vi.fn();
    render(
      <QueryErrorState error={new Error("fail")} compact onRetry={onRetry} />
    );
    const btn = screen.getByRole("button", { name: /retry/i });
    fireEvent.click(btn);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("uses default title when none provided", () => {
    render(<QueryErrorState error={new Error("oops")} />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });
});
