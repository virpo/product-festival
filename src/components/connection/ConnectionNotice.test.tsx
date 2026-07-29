import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConnectionNotice } from "./ConnectionNotice";

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
