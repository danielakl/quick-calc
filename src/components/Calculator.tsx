"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import { useCalcStore } from "@/stores/useCalcStore";
import ResultLine from "./ResultLine";

export default function Calculator() {
  const { text, results, setText } = useCalcStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
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
        <div className="text-foreground/30 font-mono text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background font-mono">
      <header className="flex items-center justify-between px-6 py-3 border-b border-border">
        <h1 className="text-sm font-medium text-foreground/50">Quick Calc</h1>
      </header>
      <div className="flex flex-1 min-h-0">
        {/* Input area */}
        <div className="w-[60%] relative">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onScroll={handleScroll}
            className="absolute inset-0 w-full h-full p-6 text-foreground font-mono text-sm leading-[1.5rem] overflow-y-auto whitespace-pre"
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
          className="w-[40%] p-6 overflow-y-auto font-mono text-sm leading-[1.5rem]"
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
