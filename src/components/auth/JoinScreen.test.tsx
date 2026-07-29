import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AccessCodeInUseError } from "@/lib/repository/supabase-repository";
import { JoinScreen } from "./JoinScreen";

describe("JoinScreen", () => {
  it("joins with an access code and exposes demo shortcuts", async () => {
    const user = userEvent.setup();
    const onJoin = vi.fn().mockResolvedValue(undefined);

    render(<JoinScreen onJoin={onJoin} mode="demo" />);

    await user.type(screen.getByLabelText("Prístupový kód"), "PETER");
    await user.click(screen.getByRole("button", { name: "Vstúpiť" }));

    expect(onJoin).toHaveBeenCalledWith("PETER", { takeover: false });
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

  it("asks before moving an active identity to this device", async () => {
    const user = userEvent.setup();
    const onJoin = vi
      .fn()
      .mockRejectedValueOnce(new AccessCodeInUseError())
      .mockResolvedValueOnce(undefined);

    render(<JoinScreen onJoin={onJoin} mode="live" />);

    await user.type(screen.getByLabelText("Prístupový kód"), "PETER");
    await user.click(screen.getByRole("button", { name: "Vstúpiť" }));

    expect(
      await screen.findByText("Tento kód sa už používa."),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "Pokračovať na tomto zariadení",
      }),
    );

    expect(onJoin).toHaveBeenLastCalledWith("PETER", { takeover: true });
  });

  it("drops the takeover action when the code changes", async () => {
    const user = userEvent.setup();
    const onJoin = vi.fn().mockRejectedValue(new AccessCodeInUseError());

    render(<JoinScreen onJoin={onJoin} mode="live" />);

    const input = screen.getByLabelText("Prístupový kód");
    await user.type(input, "PETER");
    await user.click(screen.getByRole("button", { name: "Vstúpiť" }));
    expect(
      await screen.findByRole("button", {
        name: "Pokračovať na tomto zariadení",
      }),
    ).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, "MENTOR");

    expect(
      screen.queryByRole("button", {
        name: "Pokračovať na tomto zariadení",
      }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
