import { createDemoSnapshot } from "@/lib/repository/demo-data";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ParticipantHome } from "./ParticipantHome";

describe("ParticipantHome", () => {
  const snapshot = createDemoSnapshot(new Date("2026-07-24T10:00:00Z"));
  const person = snapshot.people.find((item) => item.id === "person-peter")!;

  it("shows wallet, progress, investments and the next scan on one screen", () => {
    render(
      <ParticipantHome
        notice={null}
        onDismissNotice={vi.fn()}
        onSignOut={vi.fn()}
        person={person}
        snapshot={snapshot}
      />,
    );

    expect(screen.getAllByText("85🥞").length).toBeGreaterThan(0);
    expect(screen.getByText("PitchPal")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Upraviť PitchPal" }),
    ).toHaveAttribute("href", "/t/PITCH3?from=overview");
    expect(
      screen.getByRole("link", { name: /Skenovať ďalší tím/ }),
    ).toHaveAttribute("href", "/scan");
    expect(
      screen.getByRole("progressbar", { name: "25% tímov vyskúšaných" }),
    ).toBeInTheDocument();
  });

  it("does not expose team results before release", () => {
    render(
      <ParticipantHome
        notice={null}
        onDismissNotice={vi.fn()}
        onSignOut={vi.fn()}
        person={person}
        snapshot={snapshot}
      />,
    );

    expect(
      screen.queryByRole("link", { name: /Výsledok môjho tímu/ }),
    ).not.toBeInTheDocument();
  });

  it("shows the team result only after release", () => {
    const released = structuredClone(snapshot);
    released.event.status = "released";

    render(
      <ParticipantHome
        notice={null}
        onDismissNotice={vi.fn()}
        onSignOut={vi.fn()}
        person={person}
        snapshot={released}
      />,
    );

    expect(
      screen.getByRole("link", {
        name: "Výsledok môjho tímu QueueLess",
      }),
    ).toHaveAttribute("href", "/results");
  });
});
