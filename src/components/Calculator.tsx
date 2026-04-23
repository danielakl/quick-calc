"use client";

import { useState, useRef, useCallback, useEffect, useSyncExternalStore } from "react";
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
  const [previewMode, setPreviewMode] = useState(true);
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
    const target = source === textareaRef.current ? resultsRef.current : textareaRef.current;
    if (target) {
      target.scrollTop = source.scrollTop;
    }
  }, []);

  const lineCount = text.split("\n").length;
  const hasResults = results.some((r) => r.display !== "" || r.error !== null);
  const paddedResults = [
    ...results,
    ...Array(Math.max(0, lineCount - results.length)).fill({
      value: null,
      display: "",
      error: null,
      isAssignment: false,
    }),
  ];

  // Sync scroll position when results panel appears.
  // Uses rAF so the panel has its transitioned dimensions before we assign scrollTop.
  useEffect(() => {
    if (hasResults && textareaRef.current && resultsRef.current) {
      const textarea = textareaRef.current;
      const results = resultsRef.current;
      requestAnimationFrame(() => {
        results.scrollTop = textarea.scrollTop;
      });
    }
  }, [hasResults]);

  return (
    <div className="flex h-screen flex-col bg-background font-sans">
      {hydrated ? (
        <>
          <header className="flex justify-end px-6 py-3">
            <HelpModal />
            <ThemeToggle />
          </header>

          <div className="flex min-h-0 flex-1 gap-2 p-2">
            {/* Input area */}
            <div className="min-w-0 flex-1">
              <textarea
                id="calc-input"
                data-testid="calc-input"
                ref={textareaRef}
                value={text}
                autoCapitalize="off"
                onChange={(e) => setText(e.target.value)}
                onScroll={handleScroll}
                onFocus={() => setPreviewMode(true)}
                className="rounded-md hide-scrollbar h-full w-full overflow-x-auto overflow-y-scroll whitespace-nowrap bg-transparent p-6 font-mono text-base leading-6 text-foreground caret-caret selection:bg-selection transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background"
                placeholder="Type an expression..."
                aria-label="Calculator input"
                wrap="off"
                spellCheck={false}
                autoFocus
              />
            </div>

            {/* Results panel — overlay on mobile, in-flow on desktop */}
            <div
              onClick={() => previewMode && setPreviewMode(false)}
              className={`overflow-hidden border-l border-border transition-[width,opacity] duration-300 ease-in-out ${
                previewMode ? "w-[30%]" : "w-4/5"
              }`}
            >
              <div
                ref={resultsRef}
                data-testid="calc-results"
                className="h-full overflow-y-auto p-6 font-mono text-base leading-6"
                onScroll={handleScroll}
              >
                {paddedResults.map((result, i) => (
                  <ResultLine key={i} result={result} />
                ))}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="text-muted m-auto text-sm">Loading...</div>
      )}
    </div>
  );
}
