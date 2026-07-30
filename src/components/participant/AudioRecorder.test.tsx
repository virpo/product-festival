import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AudioRecorder } from "./AudioRecorder";

describe("AudioRecorder", () => {
  it("shows an existing recording and lets the user remove it", () => {
    const onChange = vi.fn();
    const onRemoveExisting = vi.fn();
    const { container } = render(
      <AudioRecorder
        existingUrl="https://example.com/feedback.webm"
        onChange={onChange}
        onRemoveExisting={onRemoveExisting}
      />,
    );

    expect(container.querySelector("audio")).toHaveAttribute(
      "src",
      "https://example.com/feedback.webm",
    );
    expect(
      screen.getByRole("button", { name: "Nahrať znova" }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Odstrániť nahrávku" }),
    );

    expect(onRemoveExisting).toHaveBeenCalledOnce();
    expect(onChange).not.toHaveBeenCalled();
  });
});
