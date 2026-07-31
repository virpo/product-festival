import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectionNotice, FestivalConnectionNotice } from "./ConnectionNotice";

const mocks = vi.hoisted(() => ({
  pathname: { current: "/" },
  festival: { current: {} as Record<string, unknown> },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname.current,
}));

vi.mock("@/lib/repository/useFestival", () => ({
  useFestival: () => mocks.festival.current,
}));

describe("ConnectionNotice", () => {
  it("shows stale data and lets the user retry immediately", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn().mockResolvedValue(undefined);

    render(
      <ConnectionNotice
        connection={{
          status: "retrying",
          stale: true,
          attempt: 2,
          message: "Živé aktualizácie sú odpojené.",
        }}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Živé aktualizácie sú odpojené.",
    );
    await user.click(screen.getByRole("button", { name: "Obnoviť" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("uses the projector treatment on the public wall", () => {
    render(
      <ConnectionNotice
        connection={{
          status: "retrying",
          stale: true,
          attempt: 1,
          message: "Spojenie vypadlo.",
        }}
        onRetry={vi.fn()}
        variant="wall"
      />,
    );

    expect(screen.getByRole("status")).toHaveClass(
      "connection-notice--wall",
    );
  });

  it("lifts above the dock only when a dock is present", () => {
    const connection = {
      status: "retrying" as const,
      stale: true,
      attempt: 1,
      message: "Spojenie vypadlo.",
    };

    const { rerender } = render(
      <ConnectionNotice connection={connection} docked onRetry={vi.fn()} />,
    );
    // Without this the notice covers the save and delete actions in the dock.
    expect(screen.getByRole("status")).toHaveClass(
      "connection-notice--docked",
    );

    rerender(<ConnectionNotice connection={connection} onRetry={vi.fn()} />);
    expect(screen.getByRole("status")).not.toHaveClass(
      "connection-notice--docked",
    );
  });

  it("stays out of the way while data is live", () => {
    const { container } = render(
      <ConnectionNotice
        connection={{ status: "live", stale: false }}
        onRetry={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});

describe("FestivalConnectionNotice", () => {
  beforeEach(() => {
    mocks.pathname.current = "/";
    mocks.festival.current = {
      commands: { refresh: vi.fn() },
      connection: {
        status: "retrying",
        stale: true,
        attempt: 1,
        message: "Spojenie vypadlo.",
      },
      currentPerson: { id: "p1", role: "participant" },
    };
  });

  function docked() {
    render(<FestivalConnectionNotice />);
    return screen.getByRole("status").className.includes(
      "connection-notice--docked",
    );
  }

  it("lifts the notice on the participant screens that carry a dock", () => {
    expect(docked()).toBe(true);
  });

  it("leaves the access-code entry screen alone", () => {
    // `/` renders JoinScreen until somebody signs in — no dock, no snackbar.
    mocks.festival.current.currentPerson = null;
    expect(docked()).toBe(false);
  });

  it("leaves the organizer home alone", () => {
    mocks.festival.current.currentPerson = { id: "o1", role: "organizer" };
    expect(docked()).toBe(false);
  });

  it("lifts the notice on the scanner and team screens", () => {
    mocks.pathname.current = "/scan";
    expect(docked()).toBe(true);
  });

  it("covers the team route", () => {
    mocks.pathname.current = "/t/ABC";
    expect(docked()).toBe(true);
  });

  it("leaves organizer routes and the wall alone", () => {
    mocks.pathname.current = "/admin";
    expect(docked()).toBe(false);
  });
});
