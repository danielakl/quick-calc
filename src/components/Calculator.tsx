"use client";

import { useRef, useCallback, useEffect, useSyncExternalStore } from "react";
import { useCalcStore, initFromURL } from "@/stores/useCalcStore";
import { initTheme } from "@/stores/useThemeStore";
import HelpModal from "./HelpModal";
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

  const handleScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
    const source = e.currentTarget;
    const target =
      source === textareaRef.current ? resultsRef.current : textareaRef.current;
    if (target) {
      target.scrollTop = source.scrollTop;
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
    <div className="relative flex h-screen bg-background font-sans">
      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-end bg-background/30 px-6 py-3 backdrop-blur-xs">
        <HelpModal />
        <ThemeToggle />
      </header>

      {/* Input area */}
      <div className="relative w-[60%]">
        <textarea
          id="calc-input"
          data-testid="calc-input"
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onScroll={handleScroll}
          className="hide-scrollbar absolute inset-0 h-full w-full overflow-y-scroll px-6 pb-6 pt-[calc(0.75rem*2+2.25rem)] font-mono text-sm leading-6 text-foreground"
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
        className="w-[40%] overflow-y-auto px-6 pb-6 pt-[calc(0.75rem*2+2.25rem)] font-mono text-sm leading-6"
        onScroll={handleScroll}
      >
        {paddedResults.map((result, i) => (
          <ResultLine key={i} result={result} />
        ))}
      </div>
    </div>
  );
}
