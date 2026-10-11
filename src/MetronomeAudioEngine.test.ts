// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vite-plus/test";
import { MetronomeAudioEngine } from "./MetronomeAudioEngine";

class FakeAudioParam {
  public readonly setValueAtTimeCalls: Array<[number, number]> = [];
  public readonly exponentialRampToValueAtTimeCalls: Array<[number, number]> = [];

  public setValueAtTime(value: number, time: number) {
    this.setValueAtTimeCalls.push([value, time]);
  }

  public exponentialRampToValueAtTime(value: number, time: number) {
    this.exponentialRampToValueAtTimeCalls.push([value, time]);
  }
}

class FakeGainNode {
  public readonly gain = new FakeAudioParam();
  public readonly connect = vi.fn();
  public readonly disconnect = vi.fn();
}

class FakeOscillatorNode {
  public readonly frequency = new FakeAudioParam();
  public readonly connect = vi.fn();
  public readonly disconnect = vi.fn();
  public readonly start = vi.fn();
  public readonly stopCalls: Array<number | undefined> = [];
  public readonly stop = vi.fn((time?: number) => {
    this.stopCalls.push(time);
  });
  public type = "";
  public onended: (() => void) | null = null;
}

class FakeAudioContext {
  public state: "running" | "suspended" | "closed" = "suspended";
  public currentTime = 42;
  public readonly destination = {};
  public readonly oscillators: FakeOscillatorNode[] = [];
  public readonly gainNodes: FakeGainNode[] = [];
  public readonly resume = vi.fn(async () => {
    this.state = "running";
  });
  public readonly close = vi.fn(async () => {
    this.state = "closed";
  });

  public createOscillator() {
    const oscillator = new FakeOscillatorNode();
    this.oscillators.push(oscillator);
    return oscillator as unknown as OscillatorNode;
  }

  public createGain() {
    const gainNode = new FakeGainNode();
    this.gainNodes.push(gainNode);
    return gainNode as unknown as GainNode;
  }
}

describe("MetronomeAudioEngine", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("schedules a stronger click for the downbeat", async () => {
    const fakeAudioContext = new FakeAudioContext();
    fakeAudioContext.state = "running";
    const AudioContextMock = vi.fn(function AudioContextMock() {
      return fakeAudioContext;
    });
    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      value: AudioContextMock,
    });

    const engine = new MetronomeAudioEngine();
    await engine.prepare();
    engine.scheduleClickSound(10, 0);
    engine.scheduleClickSound(11, 1);

    const downbeatOscillator = fakeAudioContext.oscillators[0];
    const downbeatGain = fakeAudioContext.gainNodes[0].gain;
    const regularBeatGain = fakeAudioContext.gainNodes[1].gain;

    expect(downbeatOscillator.start).toHaveBeenCalledWith(10);
    expect(downbeatGain.exponentialRampToValueAtTimeCalls[0][0]).toBeGreaterThan(
      regularBeatGain.exponentialRampToValueAtTimeCalls[0][0],
    );
  });

  it("stops all scheduled oscillators at the current audio time", async () => {
    const fakeAudioContext = new FakeAudioContext();
    fakeAudioContext.state = "running";
    const AudioContextMock = vi.fn(function AudioContextMock() {
      return fakeAudioContext;
    });
    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      value: AudioContextMock,
    });

    const engine = new MetronomeAudioEngine();
    await engine.prepare();
    engine.scheduleClickSound(10, 0);
    engine.scheduleClickSound(11, 1);

    engine.stop();

    expect(fakeAudioContext.oscillators).toHaveLength(2);
    for (const oscillator of fakeAudioContext.oscillators) {
      expect(oscillator.stop).toHaveBeenLastCalledWith(fakeAudioContext.currentTime);
    }
  });

  it("closes the audio context on dispose", async () => {
    const fakeAudioContext = new FakeAudioContext();
    fakeAudioContext.state = "running";
    const AudioContextMock = vi.fn(function AudioContextMock() {
      return fakeAudioContext;
    });
    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      value: AudioContextMock,
    });

    const engine = new MetronomeAudioEngine();
    await engine.prepare();
    await engine.dispose();

    expect(fakeAudioContext.close).toHaveBeenCalledTimes(1);
    expect(engine.getAudioContext()).toBeNull();
  });
});
