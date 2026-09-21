import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The board is served over plain HTTP on the LAN, where navigator.clipboard is
 * undefined, so the textarea + execCommand path is the normal case here rather
 * than a legacy fallback.
 */
function legacyCopy(text: string): boolean {
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.top = "0";
  area.style.left = "-9999px";
  area.style.opacity = "0";
  document.body.appendChild(area);

  const selection = document.getSelection();
  const previous = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

  area.select();
  area.setSelectionRange(0, area.value.length);

  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }

  area.remove();
  if (selection && previous) {
    selection.removeAllRanges();
    selection.addRange(previous);
  }
  return ok;
}

export async function copyText(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (window.isSecureContext && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* permission denied or blocked: fall through */
  }
  return legacyCopy(text);
}

export type CopyState = "idle" | "copied" | "failed";

export function useCopy(resetMs = 1500): { state: CopyState; copy: (text: string) => void } {
  const [state, setState] = useState<CopyState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = useCallback(
    (text: string) => {
      void copyText(text).then((ok) => {
        setState(ok ? "copied" : "failed");
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setState("idle"), resetMs);
      });
    },
    [resetMs],
  );

  return { state, copy };
}
