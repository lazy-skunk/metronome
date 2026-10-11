// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { MetronomeVisualScheduler } from "./MetronomeVisualScheduler";

describe("MetronomeVisualScheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(performance, "now").mockReturnValue(100);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("activates a beat close to the target frame", () => {
    let now = 100;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    let scheduledFrameCallback: FrameRequestCallback | null = null;
    const requestAnimationFrameMock = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) => {
        scheduledFrameCallback = callback;
        return 1;
      });
    const onBeatActivated = vi.fn();
    const scheduler = new MetronomeVisualScheduler({ onBeatActivated });

    scheduler.scheduleBeat(2, 110);

    now = 110;
    vi.advanceTimersByTime(10);
    expect(onBeatActivated).not.toHaveBeenCalled();
    expect(scheduledFrameCallback).not.toBeNull();

    if (!scheduledFrameCallback) {
      throw new Error("Expected requestAnimationFrame callback to be scheduled");
    }
    const frameCallback = scheduledFrameCallback as (time: DOMHighResTimeStamp) => void;
    frameCallback(now);

    expect(requestAnimationFrameMock).toHaveBeenCalled();
    expect(onBeatActivated).toHaveBeenCalledWith(2);
  });

  it("clears pending timeouts and animation frames", () => {
    const clearTimeoutMock = vi.spyOn(window, "clearTimeout");
    const cancelAnimationFrameMock = vi.spyOn(window, "cancelAnimationFrame");
    const requestAnimationFrameMock = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation(() => 7);
    const onBeatActivated = vi.fn();
    const scheduler = new MetronomeVisualScheduler({ onBeatActivated });

    scheduler.scheduleBeat(1, 120);
    scheduler.clear();

    expect(requestAnimationFrameMock).not.toHaveBeenCalled();
    expect(clearTimeoutMock).toHaveBeenCalled();
    expect(cancelAnimationFrameMock).not.toHaveBeenCalled();
    expect(onBeatActivated).not.toHaveBeenCalled();
  });
  it("waits through an early frame and cancels the next frame on clear", () => {
    let frameCallback!: FrameRequestCallback;
    const requestFrame = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        frameCallback = callback;
        return requestFrame.mock.calls.length;
      });
    const cancelFrame = vi.spyOn(window, "cancelAnimationFrame");
    const onBeatActivated = vi.fn();
    const scheduler = new MetronomeVisualScheduler({ onBeatActivated });

    scheduler.scheduleBeat(1, 120);
    vi.advanceTimersByTime(20);
    // performance.now() is still 100, so this frame must not activate the beat.
    frameCallback(100);
    expect(onBeatActivated).not.toHaveBeenCalled();
    expect(requestFrame).toHaveBeenCalledTimes(2);
    scheduler.clear();
    expect(cancelFrame).toHaveBeenCalledWith(2);
    expect(cancelFrame).toHaveBeenCalledTimes(1);
  });
});
