import { describe, it, expect, vi } from "vitest";
import { SessionWatcher } from "./watcher";
import type { WatchTimerHandle, WatcherCallbacks } from "./watcher";

function makeFakeTimer() {
  const pending: Map<number, () => void> = new Map();
  let nextId = 0;

  const timer: WatchTimerHandle = {
    schedule: (fn, _ms) => {
      const id = nextId++;
      pending.set(id, fn);
      return id;
    },
    cancel: (id) => {
      pending.delete(id as number);
    },
  };

  const tick = () => {
    const fns = [...pending.values()];
    pending.clear();
    for (const fn of fns) fn();
  };

  return { timer, tick };
}

describe("SessionWatcher state machine", () => {
  it("transitions IDLE -> ACTIVE on first fileChanged and calls onSessionStart once", () => {
    const { timer } = makeFakeTimer();
    const onSessionStart = vi.fn();
    const onSessionEnd = vi.fn();
    const callbacks: WatcherCallbacks = { onSessionStart, onSessionEnd };

    const watcher = new SessionWatcher(1000, callbacks, timer);
    expect(watcher.getState()).toBe("IDLE");

    watcher.fileChanged();

    expect(watcher.getState()).toBe("ACTIVE");
    expect(onSessionStart).toHaveBeenCalledTimes(1);
    expect(onSessionEnd).not.toHaveBeenCalled();
  });

  it("subsequent fileChanged while ACTIVE resets the timer but does not call onSessionStart again", () => {
    const { timer, tick } = makeFakeTimer();
    const onSessionStart = vi.fn();
    const onSessionEnd = vi.fn();

    const watcher = new SessionWatcher(1000, { onSessionStart, onSessionEnd }, timer);

    watcher.fileChanged(); // IDLE -> ACTIVE, schedules timer
    watcher.fileChanged(); // resets timer, stays ACTIVE
    watcher.fileChanged(); // resets timer again

    expect(onSessionStart).toHaveBeenCalledTimes(1);
    expect(watcher.getState()).toBe("ACTIVE");

    // Only one timer should be active; tick it -> finalize
    tick();
    expect(onSessionEnd).toHaveBeenCalledTimes(1);
    expect(watcher.getState()).toBe("IDLE");
  });

  it("transitions ACTIVE -> IDLE and calls onSessionEnd when quiet period elapses", () => {
    const { timer, tick } = makeFakeTimer();
    const onSessionStart = vi.fn();
    const onSessionEnd = vi.fn();

    const watcher = new SessionWatcher(1000, { onSessionStart, onSessionEnd }, timer);

    watcher.fileChanged(); // IDLE -> ACTIVE
    expect(watcher.getState()).toBe("ACTIVE");

    tick(); // quiet elapsed

    expect(watcher.getState()).toBe("IDLE");
    expect(onSessionEnd).toHaveBeenCalledTimes(1);
  });

  it("supports two sequential sessions correctly", () => {
    const { timer, tick } = makeFakeTimer();
    const onSessionStart = vi.fn();
    const onSessionEnd = vi.fn();

    const watcher = new SessionWatcher(1000, { onSessionStart, onSessionEnd }, timer);

    // Session 1
    watcher.fileChanged();
    expect(watcher.getState()).toBe("ACTIVE");
    tick();
    expect(watcher.getState()).toBe("IDLE");
    expect(onSessionEnd).toHaveBeenCalledTimes(1);

    // Session 2
    watcher.fileChanged();
    expect(watcher.getState()).toBe("ACTIVE");
    tick();
    expect(watcher.getState()).toBe("IDLE");

    expect(onSessionStart).toHaveBeenCalledTimes(2);
    expect(onSessionEnd).toHaveBeenCalledTimes(2);
  });

  it("stop() while ACTIVE calls onSessionEnd exactly once", () => {
    const { timer } = makeFakeTimer();
    const onSessionStart = vi.fn();
    const onSessionEnd = vi.fn();

    const watcher = new SessionWatcher(1000, { onSessionStart, onSessionEnd }, timer);

    watcher.fileChanged(); // IDLE -> ACTIVE
    expect(watcher.getState()).toBe("ACTIVE");

    watcher.stop();

    expect(watcher.getState()).toBe("IDLE");
    expect(onSessionEnd).toHaveBeenCalledTimes(1);
    // No double-finalize if stop() is called again
    watcher.stop();
    expect(onSessionEnd).toHaveBeenCalledTimes(1);
  });
});
