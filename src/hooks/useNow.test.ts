import { renderHook, act } from "@testing-library/react";
import { Temporal } from "temporal-polyfill";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useNow } from "./useNow";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useNow", () => {
  it("returns a Temporal.Instant on first render", () => {
    const { result } = renderHook(() => useNow());
    expect(result.current).toBeInstanceOf(Temporal.Instant);
  });

  it("updates the instant when the interval fires", () => {
    const { result } = renderHook(() => useNow(60_000));
    const initial = result.current;

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.epochMilliseconds).toBeGreaterThan(initial.epochMilliseconds);
  });

  it("honours a custom interval", () => {
    const { result } = renderHook(() => useNow(1_000));
    const initial = result.current;

    // Advance just under the custom interval — should not update.
    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(result.current.epochMilliseconds).toBe(initial.epochMilliseconds);

    // Cross the interval boundary — should update.
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.epochMilliseconds).toBeGreaterThan(initial.epochMilliseconds);
  });

  it("clears the interval on unmount", () => {
    const clearSpy = vi.spyOn(global, "clearInterval");
    const { unmount } = renderHook(() => useNow(60_000));
    unmount();
    expect(clearSpy).toHaveBeenCalledTimes(1);
    clearSpy.mockRestore();
  });

  it("resets the interval when intervalMilliseconds changes", () => {
    const setIntervalSpy = vi.spyOn(global, "setInterval");
    const clearIntervalSpy = vi.spyOn(global, "clearInterval");

    const { rerender } = renderHook(({ ms }: { ms: number }) => useNow(ms), {
      initialProps: { ms: 60_000 },
    });

    expect(setIntervalSpy).toHaveBeenCalledTimes(1);

    rerender({ ms: 1_000 });

    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
    expect(setIntervalSpy).toHaveBeenCalledTimes(2);

    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
  });
});
