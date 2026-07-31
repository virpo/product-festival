import { createDemoSnapshot } from "@/lib/repository/demo-data";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PancakeMarket } from "./PancakeMarket";

function releasedMarket() {
  const snapshot = createDemoSnapshot(new Date("2026-07-31T10:00:00Z"));
  snapshot.event.status = "released";
  snapshot.pancakePackages = snapshot.pancakePackages.map((item) => ({
    ...item,
    price: item.position === 6 ? 36 : item.position === 7 ? 35 : item.price,
  }));
  return {
    snapshot,
    team: snapshot.teams[0],
    viewer: snapshot.people.find((person) => person.id === "person-peter")!,
  };
}

describe("PancakeMarket", () => {
  it("shows configured packages in order with exact affordability", () => {
    const props = releasedMarket();
    render(<PancakeMarket {...props} onSelect={vi.fn()} />);

    const cards = screen.getAllByRole("article");
    expect(cards).toHaveLength(7);
    expect(cards[0]).toHaveTextContent("Nugátová plnka + jahodový kompót");
    expect(cards[6]).toHaveTextContent("Bryndza + kakaový prášok");
    expect(
      screen.getByRole("button", {
        name: "Vybrať Bryndza + kakaový prášok",
      }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", {
        name: "Vybrať Gaštanový krém + mandarínkový kompót + šľahačka",
      }),
    ).toBeDisabled();
    expect(cards[5]).toHaveTextContent("Chýba 1🥞");
  });

  it("saves an affordable team choice and acknowledges success", async () => {
    const user = userEvent.setup();
    const props = releasedMarket();
    const onSelect = vi.fn().mockResolvedValue(undefined);
    render(<PancakeMarket {...props} onSelect={onSelect} />);

    await user.click(
      screen.getByRole("button", {
        name: "Vybrať Bryndza + kakaový prášok",
      }),
    );

    expect(onSelect).toHaveBeenCalledWith("pancake-package-7");
    expect(screen.getByText("Výber pre tím je uložený.")).toBeInTheDocument();
  });

  it("preserves the persisted selection when a replacement fails", async () => {
    const user = userEvent.setup();
    const props = releasedMarket();
    props.snapshot.pancakePackages = props.snapshot.pancakePackages.map(
      (item) => ({ ...item, price: item.position === 6 ? 30 : item.price }),
    );
    props.snapshot.pancakeSelections = [
      {
        id: "selection-1",
        eventId: props.snapshot.event.id,
        teamId: props.team.id,
        packageId: "pancake-package-7",
        selectedBy: props.viewer.id,
        selectedAt: "2026-07-31T12:00:00Z",
      },
    ];
    render(
      <PancakeMarket
        {...props}
        onSelect={vi.fn().mockRejectedValue(new Error("offline"))}
      />,
    );

    await user.click(
      screen.getByRole("button", {
        name: "Vybrať Gaštanový krém + mandarínkový kompót + šľahačka",
      }),
    );

    const selectedCard = screen
      .getByText("Bryndza + kakaový prášok")
      .closest("article")!;
    expect(within(selectedCard).getByText("Vybrané pre tím")).toBeInTheDocument();
    expect(
      screen.getByText("Výber sa nepodarilo uložiť. Skús to znova."),
    ).toBeInTheDocument();
  });

  it("keeps organizer inspection read-only", () => {
    const props = releasedMarket();
    props.viewer = props.snapshot.people.find(
      (person) => person.role === "organizer",
    )!;
    render(<PancakeMarket {...props} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("Výber tímu je iba na čítanie.")).toBeInTheDocument();
  });
});
