"use client";

import { Mic, Pause, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type RecorderState = "idle" | "requesting" | "recording" | "recorded" | "error";

type AudioRecorderProps = {
  existingUrl?: string | null;
  value?: Blob | null;
  onChange(value: Blob | null): void;
  onRemoveExisting?(): void;
};

export function AudioRecorder({
  existingUrl = null,
  value = null,
  onChange,
  onRemoveExisting,
}: AudioRecorderProps) {
  const [state, setState] = useState<RecorderState>(
    value || existingUrl ? "recorded" : "idle",
  );
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const objectUrl = useMemo(
    () => (value ? URL.createObjectURL(value) : null),
    [value],
  );
  const audioUrl = objectUrl ?? existingUrl;

  useEffect(() => {
    if (state !== "recording") {
      return;
    }

    const timer = window.setInterval(() => setSeconds((current) => current + 1), 1000);
    return () => window.clearInterval(timer);
  }, [state]);

  useEffect(
    () => () => {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  useEffect(() => {
    if (!objectUrl) {
      return;
    }

    return () => URL.revokeObjectURL(objectUrl);
  }, [objectUrl]);

  async function start() {
    if (
      typeof MediaRecorder === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setState("error");
      setError("Mikrofón sa nedá použiť. Feedback môžeš napísať.");
      return;
    }

    setState("requesting");
    setError("");
    setSeconds(0);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      streamRef.current = stream;
      recorderRef.current = recorder;
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      });
      recorder.addEventListener("stop", () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        stream.getTracks().forEach((track) => track.stop());
        onChange(blob);
        setState("recorded");
      });
      recorder.start();
      setState("recording");
    } catch {
      setState("error");
      setError("Mikrofón sa nepodarilo zapnúť. Feedback môžeš napísať.");
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
      ) : state === "recorded" && audioUrl ? (
        <div className="recorded-audio">
          <audio controls src={audioUrl}>
            <track kind="captions" />
          </audio>
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
