import { createDemoSnapshot } from "@/lib/repository/demo-data";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PublicSummary } from "./PublicSummary";

describe("PublicSummary", () => {
  it("uses the configured currency after the aggregate amount", () => {
    const snapshot = createDemoSnapshot(new Date("2026-07-24T10:00:00Z"));
    const stats = { ...snapshot.stats!, totalInvested: 420 };

    render(<PublicSummary event={snapshot.event} stats={stats} />);

    expect(screen.getByText("420🥞")).toBeInTheDocument();
    expect(screen.queryByText("🥞420")).not.toBeInTheDocument();
  });
});
