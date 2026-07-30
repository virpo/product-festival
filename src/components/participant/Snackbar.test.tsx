import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Snackbar } from "./Snackbar";

describe("Snackbar", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("announces a message and dismisses it after four seconds", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();

    render(
      <Snackbar
        message="Uložené pre Ledger Lens · 17🥞"
        onDismiss={onDismiss}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Uložené pre Ledger Lens · 17🥞",
    );

    act(() => {
      vi.advanceTimersByTime(4_000);
    });

    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
