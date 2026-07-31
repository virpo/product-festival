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
    expect(screen.getByText(/Spark stanovišti/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Pokračovať" }));
    expect(onContinue).toHaveBeenCalledOnce();
  });
});
