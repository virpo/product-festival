import { createDemoSnapshot } from "@/lib/repository/demo-data";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SignalForm } from "./SignalForm";

describe("SignalForm", () => {
  const snapshot = createDemoSnapshot(new Date("2026-07-24T10:00:00Z"));
  const person = snapshot.people.find((item) => item.id === "person-peter")!;
  const team = snapshot.teams.find((item) => item.id === "team-4")!;

  it("accepts an exact amount through typing and one-euro controls", async () => {
    const user = userEvent.setup();
    render(
      <SignalForm
        onSave={vi.fn()}
        person={person}
        snapshot={snapshot}
        team={team}
      />,
    );

    const input = screen.getByLabelText("Suma");
    await user.clear(input);
    await user.type(input, "37");
    await user.click(screen.getByRole("button", { name: "Pridať euro" }));

    expect(input).toHaveValue(38);
  });

  it("requires feedback before save", async () => {
    const user = userEvent.setup();
    render(
      <SignalForm
        onSave={vi.fn()}
        person={person}
        snapshot={snapshot}
        team={team}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Poslať/ }));

    expect(screen.getByRole("alert")).toHaveTextContent("Pridaj feedback");
  });
});
