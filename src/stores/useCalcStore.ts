import { create } from "zustand";
import { persist } from "zustand/middleware";
import { evaluateLines, LineResult } from "@/lib/engine";

interface CalcState {
  text: string;
  results: LineResult[];
  setText: (text: string) => void;
}

export const useCalcStore = create<CalcState>()(
  persist(
    (set) => ({
      text: "",
      results: [],
      setText: (text: string) => {
        const lines = text.split("\n");
        const results = evaluateLines(lines);
        set({ text, results });
      },
    }),
    {
      name: "quick-calc",
      partialize: (state) => ({ text: state.text }),
      onRehydrateStorage: () => (state) => {
        if (state?.text) {
          state.setText(state.text);
        }
      },
    }
  )
);
