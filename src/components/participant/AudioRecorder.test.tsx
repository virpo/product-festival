import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AudioRecorder, baseMimeType } from "./AudioRecorder";

function fakeStream() {
  const track = { stop: vi.fn() };
  return { track, stream: { getTracks: () => [track] } as unknown as MediaStream };
}

function stubMedia(stream: MediaStream) {
  let resolveStream: (value: MediaStream) => void = () => {};
  const pending = new Promise<MediaStream>((resolve) => {
    resolveStream = resolve;
  });

  vi.stubGlobal("navigator", {
    ...navigator,
    mediaDevices: { getUserMedia: vi.fn(() => pending) },
  });

  return { grant: () => resolveStream(stream) };
}

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

describe("AudioRecorder microphone lifecycle", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stops the microphone when the recorder unmounts before permission lands", async () => {
    const { track, stream } = fakeStream();
    const { grant } = stubMedia(stream);
    vi.stubGlobal(
      "MediaRecorder",
      class {
        addEventListener() {}
        start() {}
      },
    );

    const { unmount } = render(<AudioRecorder onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Nahrať feedback" }));

    unmount();
    await act(async () => {
      grant();
    });

    expect(track.stop).toHaveBeenCalled();
  });

  it("hands the parent a Blob normalized to the base MIME type", async () => {
    const { stream } = fakeStream();
    const { grant } = stubMedia(stream);
    let stopListener: (() => void) | undefined;
    vi.stubGlobal(
      "MediaRecorder",
      class {
        // What Chromium actually reports for an audio-only recording.
        mimeType = "audio/webm;codecs=opus";
        state = "inactive";
        addEventListener(type: string, listener: () => void) {
          if (type === "stop") stopListener = listener;
        }
        start() {}
        stop() {}
      },
    );
    const onChange = vi.fn();

    render(<AudioRecorder onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Nahrať feedback" }));
    await act(async () => {
      grant();
    });

    act(() => {
      stopListener?.();
    });

    // Guards the call site, not just the helper: reverting the Blob to
    // `recorder.mimeType` would send a codec-qualified type the bucket rejects.
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange.mock.calls[0][0].type).toBe("audio/webm");
  });

  it("abandons a permission request that resolves after cancellation", async () => {
    const { track, stream } = fakeStream();
    const { grant } = stubMedia(stream);
    const started = vi.fn();
    vi.stubGlobal(
      "MediaRecorder",
      class {
        state = "inactive";
        addEventListener() {}
        start() {
          started();
        }
        stop() {}
      },
    );

    // The parent bumps this synchronously when a save or delete begins.
    const token = { current: 0 };
    render(
      <AudioRecorder
        onChange={vi.fn()}
        readCancelToken={() => token.current}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Nahrať feedback" }));

    token.current += 1;
    await act(async () => {
      grant();
    });

    // The late permission must not start a capture nobody can reach.
    expect(started).not.toHaveBeenCalled();
    expect(track.stop).toHaveBeenCalled();
  });

  it("keeps an attached recording removable when re-recording fails", async () => {
    const { stream } = fakeStream();
    const { grant } = stubMedia(stream);
    vi.stubGlobal(
      "MediaRecorder",
      class {
        constructor() {
          throw new Error("denied");
        }
      },
    );
    const onRemoveExisting = vi.fn();

    render(
      <AudioRecorder
        existingUrl="https://example.com/feedback.webm"
        hasExisting
        onChange={vi.fn()}
        onRemoveExisting={onRemoveExisting}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Nahrať znova" }));
    await act(async () => {
      grant();
    });

    // The failure is reported, but the recording that is still attached to the
    // signal must remain visible and deletable.
    expect(
      screen.getByText("Mikrofón sa nepodarilo zapnúť. Feedback môžeš napísať."),
    ).toBeInTheDocument();
    const removeButton = screen.getByRole("button", {
      name: "Odstrániť nahrávku",
    });
    fireEvent.click(removeButton);
    expect(onRemoveExisting).toHaveBeenCalledOnce();
  });

  it("offers removal for an attached recording that cannot be played", () => {
    const onRemoveExisting = vi.fn();
    // A signed-URL failure returns audioPath without an audioUrl.
    render(
      <AudioRecorder
        hasExisting
        onChange={vi.fn()}
        onRemoveExisting={onRemoveExisting}
      />,
    );

    expect(screen.getByText("Nahrávka je uložená.")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Odstrániť nahrávku" }),
    );
    expect(onRemoveExisting).toHaveBeenCalledOnce();
  });

  it("stops the microphone when the recorder cannot be constructed", async () => {
    const { track, stream } = fakeStream();
    const { grant } = stubMedia(stream);
    vi.stubGlobal(
      "MediaRecorder",
      class {
        constructor() {
          throw new Error("unsupported");
        }
      },
    );

    render(<AudioRecorder onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Nahrať feedback" }));

    await act(async () => {
      grant();
    });

    expect(track.stop).toHaveBeenCalled();
    expect(
      screen.getByText("Mikrofón sa nepodarilo zapnúť. Feedback môžeš napísať."),
    ).toBeInTheDocument();
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
