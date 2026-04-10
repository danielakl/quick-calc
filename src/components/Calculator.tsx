"use client";

import { useRef, useCallback, useEffect, useSyncExternalStore } from "react";
import { useCalcStore, initFromURL } from "@/stores/useCalcStore";
import { initTheme } from "@/stores/useThemeStore";
import ResultLine from "./ResultLine";
import ThemeToggle from "./ThemeToggle";

const emptySubscribe = () => () => {};

export default function Calculator() {
  const { text, results, setText } = useCalcStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const hydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  useEffect(() => {
    initTheme();
    initFromURL();
  }, []);

  const handleScroll = useCallback(() => {
    if (textareaRef.current && resultsRef.current) {
      resultsRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  const lineCount = text.split("\n").length;
  const paddedResults = [
    ...results,
    ...Array(Math.max(0, lineCount - results.length)).fill({
      value: null,
      display: "",
      error: null,
      isAssignment: false,
    }),
  ];

  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-muted font-sans text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background font-sans">
      <header className="flex items-center justify-end px-6 py-3">
        <ThemeToggle />
      </header>
      <div className="flex min-h-0 flex-1">
        {/* Input area */}
        <div className="relative w-[60%]">
          <textarea
            id="calc-input"
            data-testid="calc-input"
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onScroll={handleScroll}
            className="absolute inset-0 h-full w-full p-6 font-mono text-sm leading-[1.5rem] text-foreground"
            placeholder="Type an expression..."
            spellCheck={false}
            autoFocus
          />
        </div>

        {/* Divider */}
        <div className="w-px bg-border" />

        {/* Results area */}
        <div
          ref={resultsRef}
          data-testid="calc-results"
          className="w-[40%] overflow-y-auto p-6 font-mono text-sm leading-[1.5rem]"
          onScroll={() => {}}
        >
          {paddedResults.map((result, i) => (
            <ResultLine key={i} result={result} />
          ))}
        </div>
      </div>
    </div>
  );
}
