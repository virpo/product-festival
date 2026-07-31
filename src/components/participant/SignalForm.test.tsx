import { createDemoSnapshot } from "@/lib/repository/demo-data";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SignalForm } from "./SignalForm";

describe("SignalForm", () => {
  const snapshot = createDemoSnapshot(new Date("2026-07-24T10:00:00Z"));
  const person = snapshot.people.find((item) => item.id === "person-peter")!;
  const newTeam = snapshot.teams.find((item) => item.id === "team-4")!;
  const existingTeam = snapshot.teams.find((item) => item.id === "team-2")!;
  const existingSignal = snapshot.signals.find(
    (signal) =>
      signal.investorId === person.id && signal.teamId === existingTeam.id,
  )!;

  it("makes feedback primary and keeps exact pancake controls", async () => {
    const user = userEvent.setup();
    render(
      <SignalForm
        backHref="/scan"
        backLabel="skener"
        onSave={vi.fn()}
        person={person}
        snapshot={snapshot}
        team={newTeam}
      />,
    );

    const record = screen.getByRole("button", { name: "Nahrať spätnú väzbu" });
    const amount = screen.getByLabelText("Suma");
    expect(
      record.compareDocumentPosition(amount) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByText("Alebo napíš")).toBeInTheDocument();
    expect(screen.getByText("Môžeš neskôr zmeniť.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Späť na skener" })).toHaveAttribute(
      "href",
      "/scan",
    );

    await user.click(screen.getByRole("button", { name: "Nastaviť 25🥞" }));
    await user.click(screen.getByRole("button", { name: "Pridať kredit" }));

    expect(amount).toHaveValue(26);
  });

  it("accepts an exact amount through typing", async () => {
    const user = userEvent.setup();
    render(
      <SignalForm
        backHref="/scan"
        backLabel="skener"
        onSave={vi.fn()}
        person={person}
        snapshot={snapshot}
        team={newTeam}
      />,
    );

    const input = screen.getByLabelText("Suma");
    await user.clear(input);
    await user.type(input, "37");

    expect(input).toHaveValue(37);
  });

  it("requires feedback before save", async () => {
    const user = userEvent.setup();
    render(
      <SignalForm
        backHref="/scan"
        backLabel="skener"
        onSave={vi.fn()}
        person={person}
        snapshot={snapshot}
        team={newTeam}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Poslať/ }));

    expect(screen.getByRole("alert")).toHaveTextContent("Pridaj text alebo hlasovú poznámku.");
  });

  it("edits and removes an existing investment in the same form", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <SignalForm
        backHref="/"
        backLabel="Prehľad"
        existingSignal={existingSignal}
        onDelete={onDelete}
        onSave={vi.fn()}
        person={person}
        snapshot={snapshot}
        team={existingTeam}
      />,
    );

    expect(screen.getByLabelText("Suma")).toHaveValue(15);
    expect(screen.getByLabelText("Napísaná spätná väzba")).toHaveValue(
      existingSignal.feedbackText,
    );
    expect(
      screen.getByRole("button", { name: "Uložiť zmeny" }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Odstrániť investíciu" }),
    );

    expect(onDelete).toHaveBeenCalledOnce();
  });
});
