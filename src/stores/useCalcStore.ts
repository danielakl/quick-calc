import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import { create } from "zustand";
import { sanitize } from "@/lib/utils/sanitizeString";
import { isEmpty } from "@/lib/utils/stringUtils";

interface CalcState {
  text: string;
  setText: (text: string) => void;
}

function updateURL(text: string) {
  const url = new URL(window.location.href);
  if (!isEmpty(text)) {
    url.searchParams.set("q", compressToEncodedURIComponent(text));
  } else {
    url.searchParams.delete("q");
  }

  window.history.replaceState(null, "", url);
}

function readTextFromURL(): string {
  const url = new URL(window.location.href);
  const compressed = url.searchParams.get("q");
  if (isEmpty(compressed)) {
    return "";
  }

  const decompressed = decompressFromEncodedURIComponent(compressed);
  if (isEmpty(decompressed)) {
    return "";
  }

  return sanitize(decompressed) ?? "";
}

export const useCalcStore = create<CalcState>()((set) => ({
  text: "",
  setText: (text: string) => {
    set({ text });
    updateURL(text);
  },
}));

export function initFromURL() {
  const text = readTextFromURL();
  if (text) {
    useCalcStore.getState().setText(text);
  }
}
