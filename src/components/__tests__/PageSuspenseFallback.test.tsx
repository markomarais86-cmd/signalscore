import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageSuspenseFallback } from "../PageSuspenseFallback";

// Mock the skeleton components to keep tests simple
vi.mock("@/components/DashboardSkeleton", () => ({
  DashboardSkeleton: () => <div data-testid="dashboard-skeleton" />,
}));
vi.mock("@/components/TableSkeleton", () => ({
  TableSkeleton: () => <div data-testid="table-skeleton" />,
}));
vi.mock("@/components/SettingsSkeleton", () => ({
  SettingsSkeleton: () => <div data-testid="settings-skeleton" />,
}));

describe("PageSuspenseFallback", () => {
  it("renders dashboard skeleton for dashboard variant", () => {
    render(<PageSuspenseFallback variant="dashboard" />);
    expect(screen.getByTestId("dashboard-skeleton")).toBeInTheDocument();
  });

  it("renders table skeleton for table variant", () => {
    render(<PageSuspenseFallback variant="table" />);
    expect(screen.getByTestId("table-skeleton")).toBeInTheDocument();
  });

  it("renders settings skeleton for settings variant", () => {
    render(<PageSuspenseFallback variant="settings" />);
    expect(screen.getByTestId("settings-skeleton")).toBeInTheDocument();
  });

  it("renders minimal spinner by default", () => {
    render(<PageSuspenseFallback />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("renders minimal spinner for explicit minimal variant", () => {
    render(<PageSuspenseFallback variant="minimal" />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });
});
