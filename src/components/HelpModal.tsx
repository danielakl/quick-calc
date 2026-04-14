"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import CloseIcon from "./icons/CloseIcon";
import HelpIcon from "./icons/HelpIcon";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-foreground">{title}</h3>
      <div className="space-y-1 text-sm text-muted">{children}</div>
    </div>
  );
}

function Example({ input, result }: { input: string; result?: string }) {
  return (
    <div className="flex items-baseline gap-3 font-mono text-xs">
      <code className="text-foreground">{input}</code>
      {result && (
        <span className="text-accent-dim">
          {"\u2192"} {result}
        </span>
      )}
    </div>
  );
}

export default function HelpModal() {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, close]);

  return (
    <>
      <button
        data-testid="help-open"
        onClick={() => setOpen(true)}
        aria-label="Open help"
        className="cursor-pointer rounded-md p-2 text-muted transition-colors duration-150 ease-in-out hover:bg-surface-alt hover:text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background active:scale-[0.98]"
      >
        <HelpIcon />
      </button>

      {open &&
        createPortal(
          <div
            data-testid="help-overlay"
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-xs"
            onClick={close}
          >
            <div
              data-testid="help-modal"
              className="mx-4 max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-surface p-6 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-5 flex items-center justify-between">
                <h2 className="font-sans text-base font-semibold text-foreground">
                  Help
                </h2>
                <button
                  data-testid="help-close"
                  onClick={close}
                  aria-label="Close help"
                  className="cursor-pointer rounded-md p-1 text-muted transition-colors duration-150 ease-in-out hover:bg-surface-alt hover:text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background active:scale-[0.98]"
                >
                  <CloseIcon />
                </button>
              </div>

              <div className="space-y-5">
                <Section title="Basic Math">
                  <p>Type one expression per line. Supported operators:</p>
                  <div className="mt-1 space-y-0.5">
                    <Example input="5 + 3" result="8" />
                    <Example input="2 * (4 + 1)" result="10" />
                    <Example input="10 / 3" result="3.333..." />
                    <Example input="2 ^ 8" result="256" />
                    <Example input="17 % 5" result="2" />
                  </div>
                </Section>

                <Section title="Comments">
                  <p>Lines starting with // or # are ignored.</p>
                  <div className="mt-1 space-y-0.5">
                    <Example input="// monthly budget" />
                    <Example input="# tax rate" />
                  </div>
                </Section>

                <Section title="Variables">
                  <p>
                    Assign values to variables and reuse them on later lines.
                  </p>
                  <div className="mt-1 space-y-0.5">
                    <Example input="price = 49.99" />
                    <Example input="qty = 3" />
                    <Example input="price * qty" result="149.97" />
                  </div>
                </Section>

                <Section title="Constants">
                  <div className="space-y-0.5">
                    <Example input="pi" result="3.14159..." />
                    <Example input="e" result="2.71828..." />
                  </div>
                </Section>

                <Section title="Built-in References">
                  <p>
                    Special variables that update automatically as you type.
                  </p>
                  <div className="mt-1 space-y-0.5">
                    <Example
                      input="prev"
                      result="result of the previous line"
                    />
                    <Example input="sum" result="total of all results so far" />
                    <Example
                      input="average"
                      result="mean of all results so far"
                    />
                  </div>
                </Section>

                <Section title="Name Counting">
                  <p>
                    Unrecognized names are treated as&nbsp;1. List names, then
                    use <code className="font-mono text-foreground">sum</code>{" "}
                    to count them.
                  </p>
                  <div className="mt-1 space-y-0.5">
                    <Example input="Alice" result="1" />
                    <Example input="Bob" result="1" />
                    <Example input="Charlie" result="1" />
                    <Example input="sum" result="3" />
                  </div>
                </Section>

                <Section title="Functions">
                  <p>All standard math functions are available.</p>
                  <div className="mt-1 space-y-0.5">
                    <Example input="sqrt(144)" result="12" />
                    <Example input="sin(pi / 2)" result="1" />
                    <Example input="log(1000, 10)" result="3" />
                    <Example input="round(3.7)" result="4" />
                    <Example input="abs(-42)" result="42" />
                    <Example input="max(3, 7, 2)" result="7" />
                  </div>
                </Section>

                <Section title="Custom Functions">
                  <p>
                    Assign an expression with unknowns to create a function.
                  </p>
                  <div className="mt-1 space-y-0.5">
                    <Example input="f = x^2 + 1" />
                    <Example input="f(3)" result="10" />
                    <Example input="area = w * h" />
                    <Example input="area(3, 4)" result="12" />
                  </div>
                </Section>

                <Section title="Derivatives">
                  <p>
                    Take the derivative of a function with{" "}
                    <code className="font-mono text-foreground">derivate</code>,{" "}
                    <code className="font-mono text-foreground">derive</code>,
                    or{" "}
                    <code className="font-mono text-foreground">
                      derivative
                    </code>
                    .
                  </p>
                  <div className="mt-1 space-y-0.5">
                    <Example input="f = x^2 + x" />
                    <Example input="g = derivate(f)" />
                    <Example input="g(3)" result="7" />
                  </div>
                </Section>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
