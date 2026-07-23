import { createDemoSnapshot } from "@/lib/repository/demo-data";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Portfolio, type PortfolioCommands } from "./Portfolio";

function makeCommands(): PortfolioCommands {
  return {
    removeSignal: vi.fn().mockResolvedValue(undefined),
    upsertSignal: vi.fn().mockResolvedValue(undefined),
  };
}

describe("Portfolio", () => {
  const snapshot = createDemoSnapshot(new Date("2026-07-24T10:00:00Z"));
  const person = snapshot.people.find((item) => item.id === "person-peter")!;

  it("edits amount and feedback directly while open", async () => {
    const user = userEvent.setup();
    const commands = makeCommands();
    render(
      <Portfolio commands={commands} person={person} snapshot={snapshot} />,
    );

    await user.click(screen.getByRole("button", { name: "Upraviť PitchPal" }));
    const feedback = screen.getByLabelText("Feedback pre PitchPal");
    await user.clear(feedback);
    await user.type(feedback, "Kratší onboarding.");
    await user.click(screen.getByRole("button", { name: "Uložiť PitchPal" }));

    expect(commands.upsertSignal).toHaveBeenCalledWith(
      expect.objectContaining({ feedbackText: "Kratší onboarding." }),
    );
  });

  it("is read-only after lock", () => {
    const commands = makeCommands();
    const lockedSnapshot = structuredClone(snapshot);
    lockedSnapshot.event.status = "locked";

    render(
      <Portfolio
        commands={commands}
        person={person}
        snapshot={lockedSnapshot}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Odstrániť PitchPal" }),
    ).not.toBeInTheDocument();
  });
});
