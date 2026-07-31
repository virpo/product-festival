import type { FestivalSnapshot } from "@/lib/domain/types";
import { createDemoSnapshot } from "@/lib/repository/demo-data";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PancakeMarketAdmin } from "./PancakeMarketAdmin";

function snapshotAt(status: FestivalSnapshot["event"]["status"]) {
  const snapshot = createDemoSnapshot(new Date("2026-07-31T10:00:00Z"));
  snapshot.event.status = status;
  return snapshot;
}

describe("PancakeMarketAdmin", () => {
  it("shows provisional team amounts in team-number order", () => {
    const snapshot = snapshotAt("open");
    snapshot.signals = [
      { ...snapshot.signals[0], id: "signal-a", teamId: "team-2", amount: 500 },
      { ...snapshot.signals[0], id: "signal-b", teamId: "team-1", amount: 1 },
    ];
    render(<PancakeMarketAdmin onSave={vi.fn()} snapshot={snapshot} />);

    expect(screen.getByText("Priebežné sumy tímov")).toBeInTheDocument();
    const rows = within(screen.getByRole("list", { name: "Sumy tímov" }))
      .getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("QueueLess");
    expect(rows[0]).toHaveTextContent("1🥞");
    expect(rows[1]).toHaveTextContent("PitchPal");
    expect(rows[1]).toHaveTextContent("500🥞");
  });

  it("keeps the editor available with final amounts while locked", () => {
    render(
      <PancakeMarketAdmin onSave={vi.fn()} snapshot={snapshotAt("locked")} />,
    );

    expect(screen.getByText("Konečné sumy tímov")).toBeInTheDocument();
    expect(screen.getAllByRole("textbox")).toHaveLength(7);
    expect(
      screen.getByRole("button", { name: "Uložiť nastavenia burzy" }),
    ).toBeEnabled();
    expect(screen.getByLabelText("Cena balíčka 1")).toHaveAttribute(
      "max",
      "2147483647",
    );
  });

  it("validates descending prices before saving", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<PancakeMarketAdmin onSave={onSave} snapshot={snapshotAt("open")} />);

    const secondPrice = screen.getByLabelText("Cena balíčka 2");
    await user.clear(secondPrice);
    await user.type(secondPrice, "700");
    await user.click(
      screen.getByRole("button", { name: "Uložiť nastavenia burzy" }),
    );

    expect(screen.getByText("Ceny musia v poradí prísne klesať.")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("preserves dirty drafts across snapshot refetches and failed saves", async () => {
    const user = userEvent.setup();
    const snapshot = snapshotAt("open");
    const onSave = vi.fn().mockRejectedValue(new Error("offline"));
    const view = render(
      <PancakeMarketAdmin onSave={onSave} snapshot={snapshot} />,
    );
    const firstName = screen.getByLabelText("Názov balíčka 1");
    await user.clear(firstName);
    await user.type(firstName, "  Peterov nugát  ");
    await user.click(
      screen.getByRole("button", { name: "Uložiť nastavenia burzy" }),
    );

    const refreshed = structuredClone(snapshot);
    refreshed.signals.push({
      ...refreshed.signals[0],
      id: "new-signal",
      amount: 2,
    });
    view.rerender(<PancakeMarketAdmin onSave={onSave} snapshot={refreshed} />);

    expect(screen.getByLabelText("Názov balíčka 1")).toHaveValue(
      "  Peterov nugát  ",
    );
    expect(screen.getByText("Nastavenia sa nepodarilo uložiť. Skús to znova.")).toBeInTheDocument();
    expect(onSave).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ name: "Peterov nugát", position: 1 }),
      ]),
      expect.arrayContaining([
        expect.objectContaining({
          name: "Nugátová plnka + jahodový kompót",
          position: 1,
        }),
      ]),
    );
  });

  it("saves against the catalogue that the dirty draft started from", async () => {
    const user = userEvent.setup();
    const snapshot = snapshotAt("open");
    const onSave = vi.fn().mockRejectedValue(new Error("stale"));
    const view = render(
      <PancakeMarketAdmin onSave={onSave} snapshot={snapshot} />,
    );
    const firstName = screen.getByLabelText("Názov balíčka 1");
    await user.clear(firstName);
    await user.type(firstName, "Peterov nugát");

    const remote = structuredClone(snapshot);
    remote.pancakePackages[0].name = "Vzdialený nugát";
    view.rerender(<PancakeMarketAdmin onSave={onSave} snapshot={remote} />);
    await user.click(
      screen.getByRole("button", { name: "Uložiť nastavenia burzy" }),
    );

    expect(onSave).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ name: "Peterov nugát", position: 1 }),
      ]),
      expect.arrayContaining([
        expect.objectContaining({
          name: "Nugátová plnka + jahodový kompót",
          position: 1,
        }),
      ]),
    );
  });

  it("explains a stale catalogue conflict without discarding the draft", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue(
      new Error(
        "Katalóg sa medzitým zmenil. Obnov stránku a zopakuj úpravy.",
      ),
    );
    render(<PancakeMarketAdmin onSave={onSave} snapshot={snapshotAt("open")} />);
    const firstName = screen.getByLabelText("Názov balíčka 1");
    await user.clear(firstName);
    await user.type(firstName, "Peterov nugát");

    await user.click(
      screen.getByRole("button", { name: "Uložiť nastavenia burzy" }),
    );

    expect(
      screen.getByText(
        "Katalóg sa medzitým zmenil. Obnov stránku a zopakuj úpravy.",
      ),
    ).toBeInTheDocument();
    expect(firstName).toHaveValue("Peterov nugát");
  });

  it("moves complete package rows and rewrites positions", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<PancakeMarketAdmin onSave={onSave} snapshot={snapshotAt("open")} />);

    await user.click(
      screen.getByRole("button", { name: "Posunúť balíček 2 vyššie" }),
    );


    expect(screen.getByLabelText("Názov balíčka 1")).toHaveValue(
      "Čoko-oriešková plnka + banánová plnka",
    );
    expect(screen.getByLabelText("Cena balíčka 1")).toHaveValue(600);
  });
  it("keeps submitted drafts visible until the successful write is refetched", async () => {
    const user = userEvent.setup();
    const snapshot = snapshotAt("open");
    const onSave = vi.fn().mockResolvedValue(undefined);
    const view = render(
      <PancakeMarketAdmin onSave={onSave} snapshot={snapshot} />,
    );
    const firstName = screen.getByLabelText("Názov balíčka 1");
    await user.clear(firstName);
    await user.type(firstName, "Peterov nugát");
    await user.click(
      screen.getByRole("button", { name: "Uložiť nastavenia burzy" }),
    );

    view.rerender(
      <PancakeMarketAdmin
        onSave={onSave}
        snapshot={structuredClone(snapshot)}
      />,
    );

    expect(screen.getByLabelText("Názov balíčka 1")).toHaveValue(
      "Peterov nugát",
    );
    expect(
      screen.getByText("Palacinkové balíčky sú uložené."),
    ).toBeInTheDocument();
  });

  it("applies a newer catalogue that arrives before save completion", async () => {
    const user = userEvent.setup();
    const snapshot = snapshotAt("open");
    let resolveSave!: () => void;
    const onSave = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
    );
    const view = render(
      <PancakeMarketAdmin onSave={onSave} snapshot={snapshot} />,
    );

    const firstName = screen.getByLabelText("Názov balíčka 1");
    await user.clear(firstName);
    await user.type(firstName, "Peterov nugát");
    await user.click(
      screen.getByRole("button", { name: "Uložiť nastavenia burzy" }),
    );

    const newer = structuredClone(snapshot);
    newer.pancakePackages[0].name = "Novší vzdialený nugát";
    view.rerender(
      <PancakeMarketAdmin onSave={onSave} snapshot={newer} />,
    );

    await act(async () => resolveSave());

    await waitFor(() =>
      expect(screen.getByLabelText("Názov balíčka 1")).toHaveValue(
        "Novší vzdialený nugát",
      ),
    );
    expect(
      screen.getByText(
        "Balíčky boli uložené a potom zmenené iným organizátorom.",
      ),
    ).toBeInTheDocument();
  });

  it("disables catalogue controls while a save is pending", async () => {
    const user = userEvent.setup();
    let resolveSave!: () => void;
    const onSave = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
    );
    render(<PancakeMarketAdmin onSave={onSave} snapshot={snapshotAt("open")} />);

    await user.click(
      screen.getByRole("button", { name: "Uložiť nastavenia burzy" }),
    );

    expect(screen.getByLabelText("Názov balíčka 1")).toBeDisabled();
    expect(screen.getByLabelText("Cena balíčka 1")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Posunúť balíček 2 nižšie" }),
    ).toBeDisabled();

    await act(async () => resolveSave());
  });

  it("shows read-only fulfillment after release without ranking", () => {
    const snapshot = snapshotAt("released");
    snapshot.pancakeSelections = [
      {
        id: "selection-1",
        eventId: snapshot.event.id,
        teamId: "team-1",
        packageId: "pancake-package-7",
        selectedBy: "person-peter",
        selectedAt: "2026-07-31T12:00:00Z",
      },
    ];
    render(<PancakeMarketAdmin onSave={vi.fn()} snapshot={snapshot} />);

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByText("Objednávky tímov")).toBeInTheDocument();
    expect(screen.getByText("Bryndza + kakaový prášok")).toBeInTheDocument();
    expect(screen.getByText(/Vybral Peter/)).toBeInTheDocument();
    expect(screen.getAllByText("Zatiaľ nevybrané")).toHaveLength(8);
    expect(screen.queryByText(/rank|miesto|víťaz/i)).not.toBeInTheDocument();
  });
});
