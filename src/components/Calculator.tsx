"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useCurrencyRates } from "@/hooks/useCurrencyRates";
import { useNow } from "@/hooks/useNow";
import { evaluate } from "@/lib/engine";
import { isEmpty } from "@/lib/utils/stringUtils";
import { initFromURL, useCalcStore } from "@/stores/useCalcStore";
import { initCurrencyStore } from "@/stores/useCurrencyStore";
import { initTheme } from "@/stores/useThemeStore";
import CurrencyStatus from "./CurrencyStatus";
import HelpModal from "./HelpModal";
import ResultLine from "./ResultLine";
import ThemeToggle from "./ThemeToggle";

const emptySubscribe = () => () => {};

export default function Calculator() {
  const { text, setText } = useCalcStore();
  const ratesVersion = useCurrencyRates();
  const now = useNow();
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
    initCurrencyStore();
  }, []);

  const handleScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
    const source = e.currentTarget;
    const target = source === textareaRef.current ? resultsRef.current : textareaRef.current;
    if (target) {
      target.scrollTop = source.scrollTop;
    }
  }, []);

  // Re-evaluate when text changes OR when currency rates change. The engine
  // reads mathjs-registered units at evaluation time, so a rates bump is all
  // we need to refresh currency-bearing lines.
  const results = useMemo(
    () => evaluate(text),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [text, ratesVersion],
  );

  const hasResults = results.some((r) => !isEmpty(r.display) || !isEmpty(r.error));

  // Sync scroll position when results panel appears.
  // Uses rAF so the panel has its transitioned dimensions before we assign scrollTop.
  useEffect(() => {
    if (hasResults && textareaRef.current && resultsRef.current) {
      const textarea = textareaRef.current;
      const resultsElement = resultsRef.current;
      requestAnimationFrame(() => {
        resultsElement.scrollTop = textarea.scrollTop;
      });
    }
  }, [hasResults]);

  return (
    <div className="flex h-screen flex-col bg-background font-sans">
      {hydrated ? (
        <>
          <header className="flex items-center justify-end gap-1 px-6 py-3">
            <CurrencyStatus now={now} />
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
                {results.map((result, i) => (
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
