import { createDemoSnapshot } from "@/lib/repository/demo-data";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QrSheet } from "./QrSheet";

describe("QrSheet", () => {
  it("prints one QR card per active team without investor data", () => {
    const snapshot = createDemoSnapshot(new Date("2026-07-24T10:00:00Z"));
    const teams = snapshot.teams.filter((team) => !team.archived);

    render(
      <QrSheet
        event={snapshot.event}
        origin="https://festival.test"
        teams={teams}
      />,
    );

    expect(screen.getAllByTestId("team-qr")).toHaveLength(teams.length);
    expect(
      screen.getByText("https://festival.test/t/QUEUE7"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/€180/)).not.toBeInTheDocument();
  });
});
