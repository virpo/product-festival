import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AudioRecorder, baseMimeType } from "./AudioRecorder";

describe("baseMimeType", () => {
  it("strips codec parameters the storage bucket would reject", () => {
    expect(baseMimeType("audio/webm;codecs=opus")).toBe("audio/webm");
    expect(baseMimeType("audio/mp4; codecs=mp4a.40.2")).toBe("audio/mp4");
  });

  it("keeps a plain type and falls back when the browser reports none", () => {
    expect(baseMimeType("audio/ogg")).toBe("audio/ogg");
    expect(baseMimeType("")).toBe("audio/webm");
    expect(baseMimeType(undefined)).toBe("audio/webm");
  });
});

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
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("clears the retained recording when a re-recorded clip is deleted", () => {
    const onChange = vi.fn();
    const onRemoveExisting = vi.fn();
    render(
      <AudioRecorder
        existingUrl="https://example.com/feedback.webm"
        onChange={onChange}
        onRemoveExisting={onRemoveExisting}
        value={new Blob(["fresh"], { type: "audio/webm" })}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Odstrániť nahrávku" }),
    );

    expect(onChange).toHaveBeenCalledWith(null);
    expect(onRemoveExisting).toHaveBeenCalledOnce();
  });
});
