export type WatchState = "IDLE" | "ACTIVE";

export interface WatchTimerHandle {
  schedule: (fn: () => void, ms: number) => unknown;
  cancel: (id: unknown) => void;
}

export const realTimer: WatchTimerHandle = {
  schedule: (fn, ms) => setTimeout(fn, ms),
  cancel: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
};

export interface WatcherCallbacks {
  onSessionStart: () => void;
  onSessionEnd: () => void;
}

export class SessionWatcher {
  private state: WatchState = "IDLE";
  private timerId: unknown = null;

  constructor(
    private readonly quietMs: number,
    private readonly callbacks: WatcherCallbacks,
    private readonly timer: WatchTimerHandle = realTimer
  ) {}

  fileChanged(): void {
    if (this.state === "IDLE") {
      this.state = "ACTIVE";
      this.callbacks.onSessionStart();
    }
    if (this.timerId !== null) this.timer.cancel(this.timerId);
    this.timerId = this.timer.schedule(() => this.onQuietElapsed(), this.quietMs);
  }

  private onQuietElapsed(): void {
    if (this.state !== "ACTIVE") return;
    this.state = "IDLE";
    this.timerId = null;
    this.callbacks.onSessionEnd();
  }

  stop(): void {
    if (this.timerId !== null) {
      this.timer.cancel(this.timerId);
      this.timerId = null;
    }
    if (this.state === "ACTIVE") {
      this.state = "IDLE";
      this.callbacks.onSessionEnd();
    }
  }

  getState(): WatchState {
    return this.state;
  }
}
