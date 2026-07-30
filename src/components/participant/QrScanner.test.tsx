import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QrScanner } from "./QrScanner";

const mocks = vi.hoisted(() => ({
  clear: vi.fn(),
  router: { push: vi.fn() },
  start: vi.fn(),
  stop: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mocks.router,
}));

vi.mock("html5-qrcode", () => ({
  Html5Qrcode: function Html5Qrcode() {
    return {
      clear: mocks.clear,
      start: mocks.start,
      stop: mocks.stop,
    };
  },
}));

describe("QrScanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.start.mockResolvedValue(undefined);
  });

  it("waits for the active scan to stop before clearing on unmount", async () => {
    let finishStopping = () => undefined;
    mocks.stop.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishStopping = resolve;
        }),
    );

    const { unmount } = render(<QrScanner />);

    await waitFor(() => expect(mocks.start).toHaveBeenCalledOnce());
    unmount();

    expect(mocks.stop).toHaveBeenCalledOnce();
    expect(mocks.clear).not.toHaveBeenCalled();

    await act(async () => {
      finishStopping();
      await Promise.resolve();
    });

    expect(mocks.clear).toHaveBeenCalledOnce();
  });

  it("does not crash when stop throws before the camera starts", async () => {
    mocks.start.mockRejectedValueOnce(new Error("Camera unavailable"));
    mocks.stop.mockImplementationOnce(() => {
      throw new Error("Cannot stop, scanner is not running or paused.");
    });

    const { unmount } = render(<QrScanner />);

    await waitFor(() => expect(mocks.start).toHaveBeenCalledOnce());

    expect(() => unmount()).not.toThrow();
  });

  it("keeps scanning, manual entry and the overview escape in one flow", async () => {
    const user = userEvent.setup();
    render(<QrScanner />);

    expect(screen.getByText("Naskenuj QR kód")).toBeInTheDocument();
    expect(screen.queryByText("QR nájdeš na stole pri produkte."))
      .not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Späť na Prehľad" })).toHaveAttribute(
      "href",
      "/",
    );

    await user.type(screen.getByLabelText("Kód tímu"), "queue7");
    await user.click(screen.getByRole("button", { name: "Otvoriť tím" }));

    expect(mocks.router.push).toHaveBeenCalledWith("/t/QUEUE7");
  });
});
