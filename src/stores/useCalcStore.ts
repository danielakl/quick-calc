import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from "lz-string";
import { create } from "zustand";
import { evaluateLines, LineResult } from "@/lib/engine";

interface CalcState {
  text: string;
  results: LineResult[];
  setText: (text: string) => void;
}

function sanitize(raw: string): string {
  return (
    raw
      // Normalize newlines
      .replace(/\r\n?/g, "\n")
      .normalize("NFC")
      // Strip unpaired UTF-16 surrogates
      .replace(
        /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,
        "",
      )
      .trim()
  );
}

function updateURL(text: string) {
  const url = new URL(window.location.href);
  if (text) {
    url.searchParams.set("q", compressToEncodedURIComponent(text));
  } else {
    url.searchParams.delete("q");
  }
  window.history.replaceState(null, "", url);
}

function readTextFromURL(): string {
  const url = new URL(window.location.href);
  const compressed = url.searchParams.get("q");
  if (!compressed) return "";
  const decompressed = decompressFromEncodedURIComponent(compressed);
  if (!decompressed) return "";
  return sanitize(decompressed);
}

export const useCalcStore = create<CalcState>()((set) => ({
  text: "",
  results: [],
  setText: (text: string) => {
    const lines = text.split("\n");
    const results = evaluateLines(lines);
    set({ text, results });
    updateURL(text);
  },
}));

export function initFromURL() {
  const text = readTextFromURL();
  if (text) {
    useCalcStore.getState().setText(text);
  }
}
