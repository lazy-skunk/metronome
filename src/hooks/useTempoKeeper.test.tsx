// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from "vite-plus/test";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useTempoKeeper, INITIAL_TEMPO_KEEPER_PLAYBACK_STATE } from "./useTempoKeeper";
import { TempoKeeperAudioEngine } from "../services/audio/TempoKeeperAudioEngine";
import { TempoKeeperVisualScheduler } from "../services/schedulers/TempoKeeperVisualScheduler";

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

describe("useTempoKeeper", () => {
  let prepare: MockInstance<TempoKeeperAudioEngine["prepare"]>;
  let getAudioContext: MockInstance<TempoKeeperAudioEngine["getAudioContext"]>;
  let scheduleClickSound: MockInstance<TempoKeeperAudioEngine["scheduleClickSound"]>;
  let stopAudio: MockInstance<TempoKeeperAudioEngine["stop"]>;
  let scheduleBeat: MockInstance<TempoKeeperVisualScheduler["scheduleBeat"]>;
  let clearVisuals: MockInstance<TempoKeeperVisualScheduler["clear"]>;
  beforeEach(() => {
    vi.useFakeTimers();
    prepare = vi.spyOn(TempoKeeperAudioEngine.prototype, "prepare").mockResolvedValue(audioContext);
    getAudioContext = vi
      .spyOn(TempoKeeperAudioEngine.prototype, "getAudioContext")
      .mockReturnValue(audioContext);
    scheduleClickSound = vi
      .spyOn(TempoKeeperAudioEngine.prototype, "scheduleClickSound")
      .mockImplementation(() => {});
    stopAudio = vi.spyOn(TempoKeeperAudioEngine.prototype, "stop");
    scheduleBeat = vi.spyOn(TempoKeeperVisualScheduler.prototype, "scheduleBeat");
    clearVisuals = vi.spyOn(TempoKeeperVisualScheduler.prototype, "clear");
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("starts idle and updates settings", () => {
    const { result } = renderHook(useTempoKeeper);
    expect(result.current.playbackState).toEqual(INITIAL_TEMPO_KEEPER_PLAYBACK_STATE);
    act(() => {
      result.current.setTempoBpm(144);
      result.current.setBeatsPerBar(3);
    });
    expect(result.current.playbackState).toEqual({
      tempoBpm: 144,
      beatsPerBar: 3,
      status: "idle",
      activeBeatIndex: 0,
    });
  });

  it("starts real scheduling and clears audio and visuals on stop", async () => {
    const { result } = renderHook(useTempoKeeper);
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
    const { result } = renderHook(useTempoKeeper);
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
      const { result } = renderHook(useTempoKeeper);
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
    const { result, unmount } = renderHook(useTempoKeeper);
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
      const { result } = renderHook(useTempoKeeper);
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
    const { result } = renderHook(useTempoKeeper);
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
    const { result } = renderHook(useTempoKeeper);
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

  it("preserves unfinished tempo input and clamps it on commit", () => {
    const { result } = renderHook(useTempoKeeper);
    act(() => result.current.setTempoInputValue("2"));
    expect(result.current.tempoInputValue).toBe("2");
    expect(result.current.playbackState.tempoBpm).toBe(120);
    act(() => result.current.commitTempoInput());
    expect(result.current.tempoInputValue).toBe("30");
    expect(result.current.playbackState.tempoBpm).toBe(30);
    act(() => result.current.setTempoBpm(999));
    expect(result.current.playbackState.tempoBpm).toBe(240);
  });
  it("does not let an old failure stop a newer playback", async () => {
    const oldPreparation = createAudioPreparation();
    prepare.mockReturnValueOnce(oldPreparation.promise);
    const { result } = renderHook(useTempoKeeper);
    let oldStart!: Promise<boolean>;
    act(() => {
      oldStart = result.current.startPlayback();
    });
    act(() => result.current.stopPlayback());
    await act(async () => {
      expect(await result.current.startPlayback()).toBe(true);
    });
    stopAudio.mockClear();
    await act(async () => {
      oldPreparation.reject(new Error("Old setup failed"));
      expect(await oldStart).toBe(false);
    });
    expect(result.current.playbackState.status).toBe("running");
    expect(result.current.errorMessage).toBeNull();
    expect(stopAudio).not.toHaveBeenCalled();
  });
});
