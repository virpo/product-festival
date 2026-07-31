import { formatCredits } from "@/lib/domain/credits";
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
    expect(screen.getByText("spätných väzieb")).toBeInTheDocument();
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

  it("reports invested credits from the same pool as the progress bar", () => {
    const snapshot = createDemoSnapshot(new Date("2026-07-24T10:00:00Z"));
    // An organizer can invest, and those credits count toward totalInvested but
    // not toward the budget the bar describes.
    const stats = {
      ...snapshot.stats!,
      budgetTotal: 1000,
      budgetDistributed: 420,
      budgetRemaining: 580,
      budgetDistributedPercent: 42,
      totalInvested: 520,
    };

    render(<PublicWall event={snapshot.event} stats={stats} />);

    expect(screen.getByText("420🥞")).toBeInTheDocument();
    expect(screen.queryByText("520🥞")).not.toBeInTheDocument();
  });

  it("hides budget progress when the stats row carries no budget total", () => {
    const snapshot = createDemoSnapshot(new Date("2026-07-24T10:00:00Z"));
    // A frontend running against the pre-migration `event_stats` shape maps
    // every missing budget column to zero.
    const stats = {
      ...snapshot.stats!,
      budgetTotal: 0,
      budgetDistributed: 0,
      budgetRemaining: 0,
      budgetDistributedPercent: 0,
      totalInvested: 640,
    };

    render(<PublicWall event={snapshot.event} stats={stats} />);

    expect(
      screen.queryByText("Rozdelené z celého rozpočtu"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
    // The rest of the wall still renders.
    expect(screen.getByText("spätných väzieb")).toBeInTheDocument();
    // And the invested tile must not claim zero: the pre-migration schema
    // populates total_invested even though every budget column is missing.
    expect(
      screen.getByText(formatCredits(stats.totalInvested, snapshot.event.currency)),
    ).toBeInTheDocument();
    expect(stats.totalInvested).toBeGreaterThan(0);
  });
});
