// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from "vite-plus/test";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useMetronome } from "./useMetronome";
import { MetronomeAudioEngine } from "./MetronomeAudioEngine";
import { MetronomeVisualScheduler } from "./MetronomeVisualScheduler";

const audioContext = {
  currentTime: 100,
  getOutputTimestamp: () => ({ contextTime: 100, performanceTime: 100_000 }),
} as AudioContext;

function createAudioPreparation() {
  let resolve!: (context: AudioContext) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<AudioContext>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("useMetronome", () => {
  let prepare: MockInstance<MetronomeAudioEngine["prepare"]>;
  let getAudioContext: MockInstance<MetronomeAudioEngine["getAudioContext"]>;
  let scheduleClickSound: MockInstance<MetronomeAudioEngine["scheduleClickSound"]>;
  let stopAudio: MockInstance<MetronomeAudioEngine["stop"]>;
  let scheduleBeat: MockInstance<MetronomeVisualScheduler["scheduleBeat"]>;
  let clearVisuals: MockInstance<MetronomeVisualScheduler["clear"]>;
  beforeEach(() => {
    vi.useFakeTimers();
    prepare = vi.spyOn(MetronomeAudioEngine.prototype, "prepare").mockResolvedValue(audioContext);
    getAudioContext = vi
      .spyOn(MetronomeAudioEngine.prototype, "getAudioContext")
      .mockReturnValue(audioContext);
    scheduleClickSound = vi
      .spyOn(MetronomeAudioEngine.prototype, "scheduleClickSound")
      .mockImplementation(() => {});
    stopAudio = vi.spyOn(MetronomeAudioEngine.prototype, "stop");
    scheduleBeat = vi.spyOn(MetronomeVisualScheduler.prototype, "scheduleBeat");
    clearVisuals = vi.spyOn(MetronomeVisualScheduler.prototype, "clear");
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("starts real scheduling and clears audio and visuals on stop", async () => {
    const { result } = renderHook(useMetronome);
    await act(async () => {
      expect(await result.current.startPlayback()).toBe(true);
    });
    expect(result.current.playbackState.status).toBe("running");
    expect(scheduleClickSound).toHaveBeenCalledWith(100, 0);
    expect(scheduleBeat).toHaveBeenCalledWith(0, 100_000);
    act(() => result.current.stopPlayback());
    expect(result.current.playbackState.status).toBe("idle");
    expect(stopAudio).toHaveBeenCalled();
    expect(clearVisuals).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("ignores repeated starts while preparing without displaying an error", async () => {
    const preparation = createAudioPreparation();
    prepare.mockReturnValue(preparation.promise);
    const { result } = renderHook(useMetronome);
    let start!: Promise<boolean>;
    act(() => {
      start = result.current.startPlayback();
    });
    expect(result.current.playbackState.status).toBe("starting");
    await act(async () => {
      await result.current.startPlayback();
    });
    expect(prepare).toHaveBeenCalledTimes(1);
    await act(async () => {
      preparation.resolve(audioContext);
      expect(await start).toBe(true);
    });
    expect(result.current.playbackState.status).toBe("running");
    expect(result.current.errorMessage).toBeNull();
  });

  it.each(["resolve", "reject"] as const)(
    "ignores an old start that completes with %s after stop and restart",
    async (outcome) => {
      const oldPreparation = createAudioPreparation();
      const newPreparation = createAudioPreparation();
      prepare
        .mockReturnValueOnce(oldPreparation.promise)
        .mockReturnValueOnce(newPreparation.promise);
      const { result } = renderHook(useMetronome);
      let oldStart!: Promise<boolean>;
      let newStart!: Promise<boolean>;
      act(() => {
        oldStart = result.current.startPlayback();
      });
      act(() => {
        result.current.stopPlayback();
        newStart = result.current.startPlayback();
      });
      await act(async () => {
        if (outcome === "resolve") oldPreparation.resolve(audioContext);
        else oldPreparation.reject(new Error("Old setup failed"));
        expect(await oldStart).toBe(false);
      });
      expect(result.current.playbackState.status).toBe("starting");
      expect(result.current.errorMessage).toBeNull();
      await act(async () => {
        newPreparation.resolve(audioContext);
        expect(await newStart).toBe(true);
      });
      expect(result.current.playbackState.status).toBe("running");
    },
  );

  it("does not schedule playback after unmount during preparation", async () => {
    const preparation = createAudioPreparation();
    prepare.mockReturnValue(preparation.promise);
    const { result, unmount } = renderHook(useMetronome);
    let start!: Promise<boolean>;
    act(() => {
      start = result.current.startPlayback();
    });
    unmount();
    preparation.resolve(audioContext);
    expect(await start).toBe(false);
    expect(scheduleClickSound).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["unavailable", "exception"])(
    "shows start failure for %s and allows retry",
    async (failure) => {
      if (failure === "unavailable") prepare.mockResolvedValueOnce(null);
      else prepare.mockRejectedValueOnce(new Error("Audio setup failed"));
      const { result } = renderHook(useMetronome);
      await act(async () => {
        expect(await result.current.startPlayback()).toBe(false);
      });
      expect(result.current.playbackState.status).toBe("idle");
      expect(result.current.errorMessage).toBe("Audio output is unavailable. Please try again.");
      await act(async () => {
        expect(await result.current.startPlayback()).toBe(true);
      });
      expect(result.current.errorMessage).toBeNull();
      expect(result.current.playbackState.status).toBe("running");
    },
  );

  it("stays idle when the first beat cannot read the clock", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    getAudioContext.mockReturnValue(null);
    const { result } = renderHook(useMetronome);
    await act(async () => {
      expect(await result.current.startPlayback()).toBe(false);
    });
    expect(result.current.playbackState.status).toBe("idle");
    expect(result.current.errorMessage).toBe("Playback stopped unexpectedly. Please start again.");
    expect(vi.getTimerCount()).toBe(0);
    act(() => result.current.stopPlayback());
    expect(result.current.errorMessage).toBeNull();
  });

  it("stops and clears scheduled output when the running clock is lost", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { result } = renderHook(useMetronome);
    await act(async () => {
      await result.current.startPlayback();
    });
    getAudioContext.mockReturnValue(null);
    act(() => {
      vi.advanceTimersByTime(25);
    });
    expect(result.current.playbackState.status).toBe("idle");
    expect(result.current.errorMessage).toBe("Playback stopped unexpectedly. Please start again.");
    expect(stopAudio).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["visibilitychange", "pagehide"])(
    "stops playback on the %s page lifecycle event",
    async (eventName) => {
      const { result } = renderHook(useMetronome);
      await act(async () => {
        await result.current.startPlayback();
      });

      if (eventName === "visibilitychange") {
        vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
      }
      act(() => {
        const target = eventName === "visibilitychange" ? document : window;
        target.dispatchEvent(new Event(eventName));
      });

      expect(result.current.playbackState.status).toBe("idle");
      expect(result.current.playbackState.activeBeatIndex).toBe(0);
      expect(result.current.errorMessage).toBeNull();
      expect(stopAudio).toHaveBeenCalled();
      expect(clearVisuals).toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    },
  );
});
