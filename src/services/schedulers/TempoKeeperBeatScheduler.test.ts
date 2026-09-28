// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { TempoKeeperBeatScheduler } from "./TempoKeeperBeatScheduler";

describe("TempoKeeperBeatScheduler", () => {
  let currentTimeSeconds: number;

  beforeEach(() => {
    vi.useFakeTimers();
    currentTimeSeconds = 100;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts playback and schedules beats against the provided clock", () => {
    const onBeatScheduled = vi.fn();
    const scheduler = new TempoKeeperBeatScheduler({
      tempoBpm: 120,
      beatsPerBar: 4,
      clock: {
        getCurrentTimeSeconds: () => currentTimeSeconds,
        getTargetPerformanceTimeMilliseconds: (playbackTimeSeconds) => playbackTimeSeconds * 1000,
      },
      onBeatScheduled,
    });

    expect(scheduler.start(currentTimeSeconds)).toBe(true);

    expect(scheduler.getIsRunning()).toBe(true);
    expect(onBeatScheduled).toHaveBeenCalledWith(0, 100, 100000);

    vi.advanceTimersByTime(25);
    expect(onBeatScheduled).toHaveBeenCalledTimes(1);

    currentTimeSeconds = 100.6;
    vi.advanceTimersByTime(25);

    expect(onBeatScheduled).toHaveBeenCalledWith(1, 100.5, 100500);
  });

  it("stops playback when the active clock becomes unavailable", () => {
    const onClockUnavailable = vi.fn();
    const scheduler = new TempoKeeperBeatScheduler({
      tempoBpm: 120,
      beatsPerBar: 4,
      clock: {
        getCurrentTimeSeconds: () => null,
        getTargetPerformanceTimeMilliseconds: () => 0,
      },
      onClockUnavailable,
    });

    expect(scheduler.start(currentTimeSeconds)).toBe(false);

    vi.advanceTimersByTime(25);

    expect(onClockUnavailable).toHaveBeenCalledTimes(1);
    expect(scheduler.getIsRunning()).toBe(false);
  });
  it("reports failure when the first beat has no display time", () => {
    const onClockUnavailable = vi.fn();
    const onBeatScheduled = vi.fn();
    const scheduler = new TempoKeeperBeatScheduler({
      tempoBpm: 120,
      beatsPerBar: 4,
      clock: {
        getCurrentTimeSeconds: () => currentTimeSeconds,
        getTargetPerformanceTimeMilliseconds: () => null,
      },
      onClockUnavailable,
      onBeatScheduled,
    });
    expect(scheduler.start(currentTimeSeconds)).toBe(false);
    expect(scheduler.getIsRunning()).toBe(false);
    expect(onBeatScheduled).not.toHaveBeenCalled();
    expect(onClockUnavailable).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("uses supplied settings and restarts from the downbeat without duplicate timers", () => {
    const onBeatScheduled = vi.fn();
    const scheduler = new TempoKeeperBeatScheduler({
      tempoBpm: 60,
      beatsPerBar: 3,
      clock: {
        getCurrentTimeSeconds: () => currentTimeSeconds,
        getTargetPerformanceTimeMilliseconds: (time) => time * 1000,
      },
      onBeatScheduled,
    });
    expect(scheduler.start(currentTimeSeconds)).toBe(true);
    expect(scheduler.start(currentTimeSeconds)).toBe(true);
    expect(vi.getTimerCount()).toBe(1);
    currentTimeSeconds = 103;
    vi.advanceTimersByTime(25);
    expect(onBeatScheduled.mock.calls).toEqual([
      [0, 100, 100000],
      [1, 101, 101000],
      [2, 102, 102000],
      [0, 103, 103000],
    ]);
    scheduler.stop();
    expect(vi.getTimerCount()).toBe(0);
    currentTimeSeconds = 110;
    expect(scheduler.start(currentTimeSeconds)).toBe(true);
    expect(onBeatScheduled).toHaveBeenLastCalledWith(0, 110, 110000);
    scheduler.stop();
  });
});
