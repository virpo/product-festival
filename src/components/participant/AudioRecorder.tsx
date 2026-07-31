"use client";

import { Mic, Pause, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type RecorderState = "idle" | "requesting" | "recording" | "recorded" | "error";

// Browsers report codec-qualified types such as `audio/webm;codecs=opus`, but
// the festival-feedback bucket allows exact base types only, and Supabase
// Storage compares the full subtype. Upload the base type or the recording is
// rejected after the participant has already made it.
export function baseMimeType(value: string | undefined): string {
  const base = (value ?? "").split(";")[0].trim().toLowerCase();
  return base || "audio/webm";
}

type AudioRecorderProps = {
  existingUrl?: string | null;
  /**
   * Whether a recording is attached to the saved signal. Kept separate from
   * `existingUrl` because a signed-URL failure yields a playable-less recording
   * that is still attached, and the participant must still be able to remove it.
   */
  hasExisting?: boolean;
  value?: Blob | null;
  onChange(value: Blob | null): void;
  /**
   * Reports whether a capture is in flight. Only `recording` counts: during
   * `requesting` nothing has been captured yet, so saving loses nothing and the
   * participant must stay free to type instead if they never answer the prompt.
   */
  onBusyChange?(busy: boolean): void;
  onRemoveExisting?(): void;
};

export function AudioRecorder({
  existingUrl = null,
  hasExisting = false,
  value = null,
  onChange,
  onBusyChange,
  onRemoveExisting,
}: AudioRecorderProps) {
  const hasRecording = Boolean(value) || Boolean(existingUrl) || hasExisting;
  const [state, setState] = useState<RecorderState>(
    hasRecording ? "recorded" : "idle",
  );
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mountedRef = useRef(true);
  const objectUrl = useMemo(
    () => (value ? URL.createObjectURL(value) : null),
    [value],
  );
  const audioUrl = objectUrl ?? existingUrl;

  // Held in a ref so a parent passing a fresh callback each render cannot
  // retrigger the effect below.
  const busyRef = useRef(onBusyChange);
  useEffect(() => {
    busyRef.current = onBusyChange;
  }, [onBusyChange]);

  useEffect(() => {
    busyRef.current?.(state === "recording");
  }, [state]);

  useEffect(() => {
    if (state !== "recording") {
      return;
    }

    const timer = window.setInterval(() => setSeconds((current) => current + 1), 1000);
    return () => window.clearInterval(timer);
  }, [state]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  function releaseStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  useEffect(() => {
    if (!objectUrl) {
      return;
    }

    return () => URL.revokeObjectURL(objectUrl);
  }, [objectUrl]);

  // A failed start must never hide a recording that is still attached to the
  // signal: the empty error state offers no delete control, so the participant
  // would be shown "no recording" while the old one is still submitted.
  function failStart(message: string) {
    setError(message);
    setState(hasRecording ? "recorded" : "error");
  }

  async function start() {
    if (
      typeof MediaRecorder === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      failStart("Mikrofón sa nedá použiť. Feedback môžeš napísať.");
      return;
    }

    setState("requesting");
    setError("");
    setSeconds(0);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Retain the stream before anything else can throw, so every failure
      // path below still has a handle to stop the microphone with.
      streamRef.current = stream;

      // The participant can leave while the permission prompt is open; the
      // unmount cleanup already ran and would never see this stream.
      if (!mountedRef.current) {
        releaseStream();
        return;
      }

      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      });
      recorder.addEventListener("stop", () => {
        const blob = new Blob(chunksRef.current, {
          type: baseMimeType(recorder.mimeType),
        });
        stream.getTracks().forEach((track) => track.stop());
        if (streamRef.current === stream) {
          streamRef.current = null;
        }
        onChange(blob);
        setState("recorded");
      });
      recorder.start();
      setState("recording");
    } catch {
      releaseStream();
      if (!mountedRef.current) {
        return;
      }
      failStart("Mikrofón sa nepodarilo zapnúť. Feedback môžeš napísať.");
    }
  }

  function stop() {
    recorderRef.current?.stop();
  }

  function remove() {
    // Clear both the pending blob and any retained server recording. Branching
    // here would leave a re-recorded clip's original still attached to the
    // signal while the recorder shows an empty state.
    onChange(null);
    onRemoveExisting?.();
    setSeconds(0);
    setState("idle");
  }

  return (
    <div className="audio-recorder">
      {state === "recording" ? (
        <button
          aria-label="Zastaviť nahrávanie"
          className="record-button is-recording"
          onClick={stop}
          type="button"
        >
          <Pause aria-hidden="true" size={24} />
          <span>Zastaviť · {seconds}s</span>
        </button>
      ) : state === "recorded" && hasRecording ? (
        <div className="recorded-audio">
          {audioUrl ? (
            <audio controls src={audioUrl}>
              <track kind="captions" />
            </audio>
          ) : (
            // Attached but not playable (for example a signed-URL failure).
            // Still offer the controls so it can be replaced or removed.
            <p className="field-note">Nahrávka je uložená.</p>
          )}
          <button
            aria-label="Nahrať znova"
            onClick={() => void start()}
            type="button"
          >
            <RotateCcw aria-hidden="true" size={18} />
          </button>
          <button
            aria-label="Odstrániť nahrávku"
            onClick={remove}
            type="button"
          >
            <Trash2 aria-hidden="true" size={18} />
          </button>
        </div>
      ) : (
        <button
          aria-label="Nahrať feedback"
          className="record-button record-button--primary"
          disabled={state === "requesting"}
          onClick={() => void start()}
          type="button"
        >
          {state === "requesting" ? (
            <span className="tiny-spinner" />
          ) : (
            <span className="record-button__icon">
              <Mic aria-hidden="true" size={28} />
            </span>
          )}
          <strong>
            {state === "requesting" ? "Zapínam mikrofón…" : "Nahrať feedback"}
          </strong>
        </button>
      )}
      {error ? <p className="field-note field-note--error">{error}</p> : null}
    </div>
  );
}
