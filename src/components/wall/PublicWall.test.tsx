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
    };

    render(<PublicWall event={snapshot.event} stats={stats} />);

    expect(screen.getByText("64")).toBeInTheDocument();
    expect(screen.getByText("feedbackov")).toBeInTheDocument();
    expect(screen.queryByText("QueueLess")).not.toBeInTheDocument();
    expect(screen.queryByText(/rebríček|poradie/i)).not.toBeInTheDocument();
  });
});
