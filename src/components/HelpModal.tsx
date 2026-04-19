"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { evaluateLines } from "@/lib/engine";
import CloseIcon from "./icons/CloseIcon";
import HelpIcon from "./icons/HelpIcon";

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded-sm bg-accent-dim px-1.5 py-0.5 text-xs font-medium text-accent">
      {children}
    </span>
  );
}

function Section({
  title,
  tag,
  children,
}: {
  title: string;
  tag?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-2 flex items-center gap-4 text-sm font-semibold text-foreground">
        {title}
        {tag}
      </h3>
      <div className="space-y-1 text-sm text-muted">{children}</div>
    </div>
  );
}

interface ExampleLine {
  input: string;
  /** Manual override — shown instead of the engine result. */
  result?: string;
}

function ExampleGroup({ lines }: { lines: ExampleLine[] }) {
  const results = evaluateLines(lines.map((l) => l.input));
  return (
    <div className="flex max-w-xl font-mono text-xs p-2 rounded-lg border-border border">
      <div className="min-w-0 flex-1 space-y-0.5">
        {lines.map((line, i) => (
          <div key={i} className="truncate text-foreground">
            {line.input}
          </div>
        ))}
      </div>
      <div className="mx-3 w-px shrink-0 bg-border" />
      <div className="min-w-0 flex-1 space-y-0.5 text-right">
        {lines.map((line, i) => {
          const display = line.result ?? (results[i].display || undefined);
          const isAssignment = results[i].isAssignment;
          return (
            <div
              key={i}
              className={`truncate ${
                isAssignment ? "text-accent-dim" : "text-accent"
              }`}
            >
              {display ?? "\u00A0"}
            </div>
          );
        })}
      </div>
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
              className="mx-4 max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-surface p-6 shadow-lg sm:max-w-4xl"
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
                  className="cursor-pointer rounded-md p-2 text-muted transition-colors duration-150 ease-in-out hover:bg-surface-alt hover:text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background active:scale-[0.98]"
                >
                  <CloseIcon />
                </button>
              </div>

              <div className="space-y-5">
                <Section title="Basic Math">
                  <p>Type one expression per line. Supported operators:</p>
                  <div className="mt-1 space-y-0.5">
                    <ExampleGroup
                      lines={[
                        { input: "5 + 3" },
                        { input: "2 * (4 + 1)" },
                        { input: "10 / 3" },
                        { input: "2 ^ 8" },
                        { input: "17 % 5" },
                      ]}
                    />
                  </div>
                </Section>

                <Section title="Comments">
                  <p>Lines starting with // or # are ignored.</p>
                  <div className="mt-1 space-y-0.5">
                    <ExampleGroup
                      lines={[
                        { input: "// monthly budget" },
                        { input: "# tax rate" },
                      ]}
                    />
                  </div>
                </Section>

                <Section title="Variables">
                  <p>
                    Assign values to variables and reuse them on later lines.
                  </p>
                  <div className="mt-1 space-y-0.5">
                    <ExampleGroup
                      lines={[
                        { input: "price = 49.99" },
                        { input: "qty = 3" },
                        { input: "price * qty" },
                      ]}
                    />
                  </div>
                </Section>

                <Section title="Constants">
                  <div className="space-y-0.5">
                    <ExampleGroup lines={[{ input: "pi" }, { input: "e" }]} />
                  </div>
                </Section>

                <Section title="Units">
                  <p>Mixed units and exponents are supported.</p>
                  <div className="mt-1 space-y-0.5">
                    <ExampleGroup
                      lines={[
                        { input: "350 cm * 3" },
                        { input: "volume = 30 m^2 * 15 m" },
                        { input: "5 kg + 300 g" },
                      ]}
                    />
                  </div>
                </Section>

                <Section title="Unit Conversion">
                  <p>
                    Convert between units with{" "}
                    <code className="font-mono text-foreground">to</code> or{" "}
                    <code className="font-mono text-foreground">as</code>. Use{" "}
                    <code className="font-mono text-foreground">%</code> to
                    format as percent.
                  </p>
                  <div className="mt-1 space-y-0.5">
                    <ExampleGroup
                      lines={[
                        { input: "600 sec to min" },
                        { input: "30 sec as minutes" },
                        { input: "0.5 as %" },
                      ]}
                    />
                  </div>
                </Section>

                <Section title="Built-in References">
                  <p>
                    Special variables that update automatically as you type.
                  </p>
                  <div className="mt-1 space-y-0.5">
                    <ExampleGroup
                      lines={[
                        {
                          input: "prev",
                          result: "result of the previous line",
                        },
                        {
                          input: "sum",
                          result: "total of all results so far",
                        },
                        {
                          input: "average",
                          result: "mean of all results so far",
                        },
                      ]}
                    />
                  </div>
                </Section>

                <Section title="Functions">
                  <p>All standard math functions are available.</p>
                  <div className="mt-1 space-y-0.5">
                    <ExampleGroup
                      lines={[
                        { input: "sqrt(144)" },
                        { input: "sin(pi / 2)" },
                        { input: "log(1000, 10)" },
                        { input: "round(3.7)" },
                        { input: "abs(-42)" },
                        { input: "max(3, 7, 2)" },
                      ]}
                    />
                  </div>
                </Section>

                <Section title="Custom Functions">
                  <p>
                    Assign an expression with unknowns to create a function.
                  </p>
                  <div className="mt-1 space-y-0.5">
                    <ExampleGroup
                      lines={[
                        { input: "f = x^2 + 1" },
                        { input: "f(3)" },
                        { input: "area = w * h" },
                        { input: "area(3, 4)" },
                      ]}
                    />
                  </div>
                </Section>

                <Section title="Derivatives">
                  <p>
                    Take the derivative with{" "}
                    <code className="font-mono text-foreground">derivate</code>,{" "}
                    <code className="font-mono text-foreground">derive</code>,
                    or{" "}
                    <code className="font-mono text-foreground">
                      derivative
                    </code>
                    . The variable is inferred automatically.
                  </p>
                  <div className="mt-1 space-y-0.5">
                    <ExampleGroup
                      lines={[
                        { input: "derivate(3 * x + 5)" },
                        { input: "g = derivate(x^2 + x)" },
                        { input: "g(3)" },
                      ]}
                    />
                  </div>
                </Section>

                <Section title="Integrals" tag={<Tag>Beta</Tag>}>
                  <p>
                    Compute the antiderivative with{" "}
                    <code className="font-mono text-foreground">integrate</code>
                    ,{" "}
                    <code className="font-mono text-foreground">integral</code>,
                    or{" "}
                    <code className="font-mono text-foreground">
                      antiderivative
                    </code>
                    . The variable is inferred automatically.
                  </p>
                  <div className="mt-1 space-y-0.5">
                    <ExampleGroup
                      lines={[
                        { input: "integrate(x^2 + x)" },
                        { input: "g = integrate(sin(x))" },
                        { input: "g(0)" },
                      ]}
                    />
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
