import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BonusReveal } from "./BonusReveal";

const awards = [
  { achievement: "first-spark" as const, amount: 5, title: "Prvá iskra!", message: "Rozžiaril/a si festival." },
  { achievement: "first-light" as const, amount: 10, title: "Prvé svetlo!", message: "Nový pohľad." },
];

describe("BonusReveal", () => {
  it("shows a private stacked total and continues", async () => {
    const onContinue = vi.fn();
    render(<BonusReveal awards={awards} currency="🥞" onContinue={onContinue} />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "+15 🥞" })).toBeInTheDocument());
    expect(screen.getByText("Prvá iskra!")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Pokračovať" }));
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it("bursts non-interactive festival confetti around the revealed bonus", async () => {
    const { container } = render(
      <BonusReveal awards={awards} currency="🥞" onContinue={vi.fn()} />,
    );

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "+15 🥞" })).toBeInTheDocument(),
    );

    const confetti = container.querySelector(".bonus-reveal__confetti");
    expect(confetti).toHaveAttribute("aria-hidden", "true");
    expect(
      confetti?.querySelectorAll(".bonus-reveal__confetti-piece"),
    ).toHaveLength(30);
  });
});
