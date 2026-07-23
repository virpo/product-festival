import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { JoinScreen } from "./JoinScreen";

describe("JoinScreen", () => {
  it("joins with an access code and exposes demo shortcuts", async () => {
    const user = userEvent.setup();
    const onJoin = vi.fn().mockResolvedValue(undefined);

    render(<JoinScreen onJoin={onJoin} mode="demo" />);

    await user.type(screen.getByLabelText("Prístupový kód"), "PETER");
    await user.click(screen.getByRole("button", { name: "Vstúpiť" }));

    expect(onJoin).toHaveBeenCalledWith("PETER");
    expect(
      screen.getByRole("button", { name: /Organizátor/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Mentor/ })).toBeInTheDocument();
  });

  it("shows a concrete join error", async () => {
    const user = userEvent.setup();
    const onJoin = vi.fn().mockRejectedValue(new Error("Neznámy kód."));

    render(<JoinScreen onJoin={onJoin} mode="live" />);

    await user.type(screen.getByLabelText("Prístupový kód"), "NOPE");
    await user.click(screen.getByRole("button", { name: "Vstúpiť" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Neznámy kód.");
  });
});
