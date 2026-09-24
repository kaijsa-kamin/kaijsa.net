"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* A real fireplace, 2:46, recorded indoors — Sadiquecat on Freesound, CC0.
   The last four seconds are crossfaded over the first so the loop has no seam. */
const TRACK = "/audio/fireplace-loop.mp3";
const TARGET_VOLUME = 0.42;
const STEP = 0.03;
const TICK_MS = 45;

/**
 * Ambient loop, carried over from vesperance.world.
 * Never autoplays — it waits for a deliberate press, then fades in.
 *
 * The audio element is the single source of truth about whether sound is
 * coming out. `playing` only mirrors it, driven by the element's own play and
 * pause events, and is never consulted to decide what a press should do.
 *
 * That distinction is the whole fix for a bug where the button stopped being
 * able to stop anything. React state and the element could drift apart — a
 * play() promise rejects with AbortError when a pause interrupts it, and the
 * old code took that as "not playing" while the sound carried on — and once
 * the state said stopped while the element was running, every further press
 * took the start branch. Nothing short of a reload could silence it.
 */
export default function SoundToggle() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeRef = useRef<number | null>(null);
  const fadingOut = useRef(false);
  const stopGuard = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);

  const stopFade = useCallback(() => {
    if (fadeRef.current) window.clearInterval(fadeRef.current);
    fadeRef.current = null;
  }, []);

  const clearGuard = useCallback(() => {
    if (stopGuard.current) window.clearTimeout(stopGuard.current);
    stopGuard.current = null;
  }, []);

  useEffect(() => {
    return () => {
      stopFade();
      clearGuard();
      audioRef.current?.pause();
    };
  }, [stopFade, clearGuard]);

  /** Steps the volume toward a target, then runs `onDone`. */
  const fadeTo = useCallback(
    (target: number, onDone?: () => void) => {
      stopFade();
      fadeRef.current = window.setInterval(() => {
        const a = audioRef.current;
        if (!a) return stopFade();

        // <= rather than <: with a step equal to the threshold, landing exactly
        // on it would otherwise cost an extra tick and a float's worth of drift
        if (Math.abs(target - a.volume) <= STEP) {
          a.volume = target;
          stopFade();
          onDone?.();
          return;
        }
        a.volume = Math.min(1, Math.max(0, a.volume + Math.sign(target - a.volume) * STEP));
      }, TICK_MS);
    },
    [stopFade],
  );

  const ensureAudio = useCallback(() => {
    if (!audioRef.current) {
      const a = new Audio(TRACK);
      a.loop = true;
      a.preload = "auto";
      a.volume = 0;
      // the element tells us what it is doing; we do not tell it what we think
      a.addEventListener("play", () => setPlaying(true));
      a.addEventListener("pause", () => setPlaying(false));
      audioRef.current = a;
    }
    return audioRef.current;
  }, []);

  const toggle = () => {
    const a = ensureAudio();

    // caught mid-fade-out: it is still audible, so turn it back up rather than
    // starting it over from silence
    if (!a.paused && fadingOut.current) {
      clearGuard();
      fadingOut.current = false;
      setPlaying(true);
      fadeTo(TARGET_VOLUME);
      return;
    }

    if (!a.paused) {
      fadingOut.current = true;
      fadeTo(0, () => {
        clearGuard();
        a.pause();
        fadingOut.current = false;
      });

      // The fade is a courtesy; silence is the promise. setInterval is
      // throttled hard in a background tab, so a fade that should take 675ms
      // can crawl for half a minute — and until it finishes, nothing pauses.
      // A press that does not silence things is worse than an abrupt cut.
      clearGuard();
      stopGuard.current = window.setTimeout(() => {
        stopFade();
        a.pause();
        a.volume = 0;
        fadingOut.current = false;
        stopGuard.current = null;
      }, 900);
      return;
    }

    clearGuard();
    fadingOut.current = false;
    a.volume = 0;
    void a
      .play()
      .then(() => fadeTo(TARGET_VOLUME))
      // a rejection here means no sound is coming out, so there is nothing to
      // correct: the pause event has already put the button back
      .catch(() => {});
  };

  return (
    <button
      type="button"
      className={`sound${playing ? " is-playing" : ""}`}
      onClick={toggle}
      aria-pressed={playing}
      aria-label={playing ? "Mute ambient sound" : "Play ambient sound"}
      title={playing ? "Mute ambient sound" : "Play ambient sound"}
    >
      <span className="sound__hint">
        {playing ? "Mute the kaminen" : "The kaminen is silent. Click to hear her crackle."}
      </span>
      {playing ? (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
        </svg>
      )}
    </button>
  );
}
