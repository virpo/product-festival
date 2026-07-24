"use client";

import { Mic, Pause, Play, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type RecorderState = "idle" | "requesting" | "recording" | "recorded" | "error";

type AudioRecorderProps = {
  value?: Blob | null;
  onChange: (value: Blob | null) => void;
};

export function AudioRecorder({ value = null, onChange }: AudioRecorderProps) {
  const [state, setState] = useState<RecorderState>(value ? "recorded" : "idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioUrl = useMemo(
    () => (value ? URL.createObjectURL(value) : null),
    [value],
  );

  useEffect(() => {
    if (state !== "recording") {
      return;
    }

    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [state]);

  useEffect(
    () => () => {
      if (
        recorderRef.current &&
        recorderRef.current.state !== "inactive"
      ) {
        recorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  useEffect(() => {
    if (!audioUrl) {
      return;
    }

    return () => URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  async function start() {
    if (
      typeof MediaRecorder === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setState("error");
      setError("Nahrávanie v tomto prehliadači nefunguje. Feedback môžeš napísať.");
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
    onChange(null);
    setSeconds(0);
    setState("idle");
  }

  return (
    <div className="audio-recorder">
      {state === "recording" ? (
        <button className="record-button is-recording" onClick={stop} type="button">
          <Pause aria-hidden="true" size={18} />
          Zastaviť · {seconds}s
        </button>
      ) : state === "recorded" && audioUrl ? (
        <div className="recorded-audio">
          <audio controls src={audioUrl}>
            <track kind="captions" />
          </audio>
          <button aria-label="Nahrať znova" onClick={() => void start()} type="button">
            <RotateCcw aria-hidden="true" size={17} />
          </button>
          <button aria-label="Odstrániť nahrávku" onClick={remove} type="button">
            <Trash2 aria-hidden="true" size={17} />
          </button>
        </div>
      ) : (
        <button
          className="record-button"
          disabled={state === "requesting"}
          onClick={() => void start()}
          type="button"
        >
          {state === "requesting" ? (
            <span className="tiny-spinner" />
          ) : (
            <Mic aria-hidden="true" size={18} />
          )}
          {state === "requesting" ? "Zapínam mikrofón…" : "Nahrať feedback"}
        </button>
      )}
      {error ? <p className="field-note field-note--error">{error}</p> : null}
      <span className="sr-only">
        <Play aria-hidden="true" /> Hlasový feedback
      </span>
    </div>
  );
}
