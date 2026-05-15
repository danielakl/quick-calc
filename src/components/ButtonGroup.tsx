"use client";

interface ButtonGroupOption<T extends string> {
  value: T;
  label: string;
}

interface ButtonGroupProps<T extends string> {
  /** The currently selected option value. */
  value: T;
  /** Called when the user picks a different option. */
  onChange: (value: T) => void;
  /** Available options, rendered as buttons in the given order. */
  options: readonly ButtonGroupOption<T>[];
  /** Accessible label for the group. */
  ariaLabel: string;
  /** Optional test id; each button gets `${testId}-${value}`. */
  testId?: string;
}

/** Two-or-more-button toggle group. The selected button is filled with the
 *  accent colour; siblings are muted. Keyboard focus lands on each button
 *  individually (not roving) — fine for short groups. */
export default function ButtonGroup<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  testId,
}: ButtonGroupProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex rounded-md border border-border bg-surface-alt p-0.5"
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            data-testid={testId ? `${testId}-${opt.value}` : undefined}
            aria-pressed={selected}
            onClick={() => onChange(opt.value)}
            className={`cursor-pointer rounded px-3 py-1 text-sm transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-accent active:scale-[0.98] ${
              selected
                ? "bg-accent text-background"
                : "text-muted hover:bg-surface hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
