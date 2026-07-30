import { createDemoSnapshot } from "@/lib/repository/demo-data";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PublicWall } from "./PublicWall";

describe("PublicWall", () => {
  it("shows aggregate room progress without team totals or names", () => {
    const snapshot = createDemoSnapshot(new Date("2026-07-24T10:00:00Z"));
    const stats = {
      ...snapshot.stats!,
      feedbackCount: 64,
      totalInvested: 420,
      budgetDistributed: 420,
      budgetRemaining: 580,
      budgetDistributedPercent: 42,
    };

    render(<PublicWall event={snapshot.event} stats={stats} />);

    expect(screen.getByText("64")).toBeInTheDocument();
    expect(screen.getByText("feedbackov")).toBeInTheDocument();
    expect(screen.getByText("420🥞")).toBeInTheDocument();
    expect(screen.queryByText("🥞420")).not.toBeInTheDocument();
    expect(
      screen.getByText("Rozdelené z celého rozpočtu"),
    ).toBeInTheDocument();
    expect(screen.getByText("42%")).toBeInTheDocument();
    expect(screen.getByText("580🥞")).toBeInTheDocument();
    expect(screen.getByText("zostáva")).toBeInTheDocument();
    expect(screen.queryByText(/75% tímov/i)).not.toBeInTheDocument();
    expect(screen.queryByText("QueueLess")).not.toBeInTheDocument();
    expect(screen.queryByText(/rebríček|poradie/i)).not.toBeInTheDocument();
  });
});
