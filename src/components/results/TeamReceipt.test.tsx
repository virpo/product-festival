import { createDemoSnapshot } from "@/lib/repository/demo-data";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TeamReceipt } from "./TeamReceipt";

describe("TeamReceipt", () => {
  const snapshot = createDemoSnapshot(new Date("2026-07-24T10:00:00Z"));
  const team = snapshot.teams[0];
  const viewer = snapshot.people.find((person) => person.id === "person-peter")!;

  it("hides receipt before release", () => {
    const locked = structuredClone(snapshot);
    locked.event.status = "locked";

    render(<TeamReceipt snapshot={locked} team={team} viewer={viewer} />);

    expect(
      screen.getByText("Výsledky ešte nie sú odomknuté."),
    ).toBeInTheDocument();
  });

  it("shows named raw feedback after release without ranking", () => {
    const released = structuredClone(snapshot);
    released.event.status = "released";

    render(<TeamReceipt snapshot={released} team={team} viewer={viewer} />);

    expect(screen.getByText("Marek")).toBeInTheDocument();
    expect(screen.getByText("25🥞")).toBeInTheDocument();
    expect(screen.queryByText("🥞25")).not.toBeInTheDocument();
    expect(screen.queryByText(/miesto|rank/i)).not.toBeInTheDocument();
  });
});
