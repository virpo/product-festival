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

  it("dismisses on time while the parent keeps re-rendering", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const message = "Uložené pre Ledger Lens · 17🥞";
    const { rerender } = render(
      <Snackbar message={message} onDismiss={() => onDismiss()} />,
    );

    // A realtime invalidation lands every 3s and hands down a new callback.
    for (let tick = 0; tick < 3; tick += 1) {
      act(() => {
        vi.advanceTimersByTime(3_000);
      });
      rerender(<Snackbar message={message} onDismiss={() => onDismiss()} />);
    }

    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
