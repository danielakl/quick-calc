"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

interface Props {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Test id applied to the overlay (the dimmed backdrop). */
  overlayTestId?: string;
  /** Test id applied to the card itself (the dialog box). */
  cardTestId?: string;
  ariaLabelledBy?: string;
  /** Tailwind classes applied to the card — defaults to a sensible centered card. */
  cardClassName?: string;
}

const DEFAULT_CARD_CLASSES =
  "flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-lg";

/**
 * Generic modal: handles overlay click, Escape key, body scroll lock, and
 * portalling to document.body. The caller defines the card content.
 *
 * Only one modal should be open at a time in this app, so the body-overflow
 * lock is unconditional.
 */
export default function Modal({
  open,
  onClose,
  children,
  overlayTestId,
  cardTestId,
  ariaLabelledBy,
  cardClassName = DEFAULT_CARD_CLASSES,
}: Props) {
  // Lock body scroll while open.
  useEffect(() => {
    if (!open) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) {
    return null;
  }
  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      data-testid={overlayTestId}
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 p-6 backdrop-blur-xs"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        data-testid={cardTestId}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabelledBy}
        className={cardClassName}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
