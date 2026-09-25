"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceState = "idle" | "listening" | "transcribing";
export type VoiceMode = "speech" | "record" | "none";

/* Minimal typing for the (still prefixed in Safari) Web Speech API. */
type SpeechResultList = ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { results: SpeechResultList }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

export const NO_KEY_TIP =
  "Voice on the home-screen app needs setup. For now, tap the 🎤 on your keyboard to dictate.";

function detectMode(): VoiceMode {
  if (typeof window === "undefined") return "none";
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone =
    (navigator as unknown as { standalone?: boolean }).standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;
  // Apple doesn't allow speech recognition inside home-screen web apps, so
  // there we record audio and transcribe it on the server instead.
  if ((w.SpeechRecognition || w.webkitSpeechRecognition) && !(ios && standalone)) return "speech";
  if (typeof navigator.mediaDevices !== "undefined" && typeof MediaRecorder !== "undefined") return "record";
  return "none";
}

/**
 * Microphone input for the command bar. Uses the browser's built-in speech
 * recognition when available (free, words appear live); otherwise records
 * audio and sends it to /api/transcribe. Recording stops by itself after
 * ~1.5s of silence, or when stop() is called (e.g. releasing hold-to-talk).
 */
export function useVoiceInput(opts: {
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string) => void;
}) {
  const [mode, setMode] = useState<VoiceMode>("none");
  const [state, setStateRaw] = useState<VoiceState>("idle");
  // Mirrored in a ref so start() sees the live state even when called from a
  // stale closure (e.g. re-listening right after the previous result).
  const stateRef = useRef<VoiceState>("idle");
  const setState = useCallback((next: VoiceState) => {
    stateRef.current = next;
    setStateRaw(next);
  }, []);
  const cb = useRef(opts);
  cb.current = opts;
  const recognition = useRef<Recognition | null>(null);
  const recorder = useRef<{ stop: () => void } | null>(null);

  useEffect(() => setMode(detectMode()), []);

  const startSpeech = useCallback((hold: boolean) => {
    const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
    const Ctor = (w.SpeechRecognition ?? w.webkitSpeechRecognition)!;
    const rec = new Ctor();
    rec.lang = navigator.language || "en-US";
    rec.interimResults = true;
    // Hold-to-talk keeps listening through pauses until the finger lifts.
    rec.continuous = hold;
    let text = "";
    let failed = false;
    rec.onresult = (e) => {
      text = Array.from(e.results)
        .map((r) => r[0]?.transcript ?? "")
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      cb.current.onPartial(text);
    };
    rec.onerror = (e) => {
      failed = true;
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        cb.current.onError("Microphone access is blocked — allow it in your browser settings.");
      } else if (e.error === "no-speech") {
        cb.current.onError("Didn't catch that — try again.");
      } else if (e.error !== "aborted") {
        cb.current.onError("Voice input stopped unexpectedly — try again.");
      }
    };
    rec.onend = () => {
      recognition.current = null;
      setState("idle");
      if (!failed && text) cb.current.onFinal(text);
    };
    recognition.current = rec;
    setState("listening");
    try {
      rec.start();
    } catch {
      setState("idle");
      cb.current.onError("Couldn't start the microphone — tap the mic to try again.");
    }
  }, [setState]);

  const startRecording = useCallback(async (hold: boolean) => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      cb.current.onError("Microphone access is blocked — allow it in Settings for this app.");
      return;
    }
    const mimeType = ["audio/webm", "audio/mp4", "audio/aac"].find((t) => MediaRecorder.isTypeSupported?.(t));
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);

    // Silence detection so a tap-to-talk recording ends on its own.
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const analyser = ctx.createAnalyser();
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buf = new Uint8Array(analyser.fftSize);
    const startedAt = Date.now();
    let heardSpeech = false;
    let lastLoud = Date.now();
    const timer = setInterval(() => {
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += (v - 128) ** 2;
      const rms = Math.sqrt(sum / buf.length);
      if (rms > 6) {
        heardSpeech = true;
        lastLoud = Date.now();
      }
      const quietFor = Date.now() - lastLoud;
      if ((!hold && heardSpeech && quietFor > 1500) || Date.now() - startedAt > 60_000 || (!hold && !heardSpeech && quietFor > 6000)) {
        stop();
      }
    }, 100);

    function stop() {
      clearInterval(timer);
      if (rec.state !== "inactive") rec.stop();
    }

    rec.onstop = async () => {
      clearInterval(timer);
      stream.getTracks().forEach((t) => t.stop());
      ctx.close().catch(() => {});
      recorder.current = null;
      if (!heardSpeech || chunks.length === 0) {
        setState("idle");
        cb.current.onError("Didn't catch that — try again.");
        return;
      }
      setState("transcribing");
      try {
        const body = new FormData();
        body.append("audio", new Blob(chunks, { type: rec.mimeType || "audio/webm" }), "voice");
        const res = await fetch("/api/transcribe", { method: "POST", body });
        const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
        if (res.status === 501) cb.current.onError(NO_KEY_TIP);
        else if (!res.ok || !data.text) cb.current.onError(data.error ?? "Couldn't transcribe that — try again.");
        else cb.current.onFinal(data.text.trim());
      } catch {
        cb.current.onError("Couldn't reach the server — check your connection.");
      } finally {
        setState("idle");
      }
    };

    recorder.current = { stop };
    rec.start();
    setState("listening");
  }, [setState]);

  const start = useCallback(
    (options?: { hold?: boolean }) => {
      if (stateRef.current !== "idle") return;
      const hold = options?.hold ?? false;
      if (mode === "speech") startSpeech(hold);
      else if (mode === "record") void startRecording(hold);
      else cb.current.onError("Voice input isn't supported in this browser — use your keyboard's 🎤 key.");
    },
    [mode, startSpeech, startRecording],
  );

  const stop = useCallback(() => {
    recognition.current?.stop();
    recorder.current?.stop();
  }, []);

  useEffect(
    () => () => {
      recognition.current?.abort();
      recorder.current?.stop();
    },
    [],
  );

  return { mode, state, start, stop };
}
