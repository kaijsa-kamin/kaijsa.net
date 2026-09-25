"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";

const STORE = "kaijsa.theme";

/**
 * Sun and moon, beside the sound button.
 *
 * The choice is remembered; without one, the system's own preference decides.
 * The theme is applied by a script in the document head rather than here —
 * waiting for React would mean painting the dark page first and correcting it
 * a frame later, which is a flash of the wrong site.
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  // read what the head script already settled on, rather than deciding again
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  }, []);

  const flip = () => {
    const next: Theme = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try {
      window.localStorage.setItem(STORE, next);
    } catch {
      // private windows and blocked site data both land here; the choice simply
      // does not outlive the visit
    }
  };

  const toLight = theme === "dark";

  return (
    <button
      type="button"
      className="theme"
      onClick={flip}
      aria-label={toLight ? "Switch to daylight" : "Switch to the dark"}
      title={toLight ? "Daylight" : "Dark"}
    >
      {toLight ? (
        // a sun: what you are being offered, not what you have
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="4.2" />
          <g strokeWidth="1.6" strokeLinecap="round">
            <path d="M12 2.4v2.6M12 19v2.6M2.4 12h2.6M19 12h2.6M5.2 5.2l1.9 1.9M16.9 16.9l1.9 1.9M18.8 5.2l-1.9 1.9M7.1 16.9l-1.9 1.9" />
          </g>
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20.7 14.6A8.6 8.6 0 0 1 9.4 3.3a8.6 8.6 0 1 0 11.3 11.3z" />
        </svg>
      )}
    </button>
  );
}
