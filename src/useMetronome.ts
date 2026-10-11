import { MetronomeAudioEngine } from "./MetronomeAudioEngine";
import { MetronomeBeatScheduler } from "./MetronomeBeatScheduler";
import { MetronomeVisualScheduler } from "./MetronomeVisualScheduler";
import { useEffect, useRef, useState } from "react";

export const TEMPO_BPM_RANGE = {
  min: 30,
  max: 240,
} as const;

const MIN_BEATS_PER_BAR = 1;
export const INITIAL_METRONOME_PLAYBACK_STATE = {
  tempoBpm: 120,
  beatsPerBar: 4,
  status: "idle",
  activeBeatIndex: 0,
} as const satisfies MetronomePlaybackState;

export type MetronomePlaybackState = {
  tempoBpm: number;
  beatsPerBar: number;
  status: "idle" | "starting" | "running";
  activeBeatIndex: number;
};

export const useMetronome = () => {
  const [playbackState, setPlaybackState] = useState<MetronomePlaybackState>({
    ...INITIAL_METRONOME_PLAYBACK_STATE,
  });
  const [tempoInputValue, setTempoInputValue] = useState(
    String(INITIAL_METRONOME_PLAYBACK_STATE.tempoBpm),
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const audioEngineRef = useRef<MetronomeAudioEngine | null>(null);
  const beatSchedulerRef = useRef<MetronomeBeatScheduler | null>(null);
  const visualSchedulerRef = useRef<MetronomeVisualScheduler | null>(null);
  // Stop and unmount invalidate the pending start so its result cannot update the UI.
  const pendingStartRef = useRef<{ cancelled: boolean } | null>(null);

  useEffect(() => {
    const audioEngine = new MetronomeAudioEngine();
    const visualScheduler = new MetronomeVisualScheduler({
      onBeatActivated: (beatIndex) => {
        setPlaybackState((previousState) => ({
          ...previousState,
          activeBeatIndex: beatIndex,
        }));
      },
    });
    const beatScheduler = new MetronomeBeatScheduler({
      tempoBpm: INITIAL_METRONOME_PLAYBACK_STATE.tempoBpm,
      beatsPerBar: INITIAL_METRONOME_PLAYBACK_STATE.beatsPerBar,
      clock: {
        getCurrentTimeSeconds: () => audioEngine.getAudioContext()?.currentTime ?? null,
        getTargetPerformanceTimeMilliseconds: (playbackTimeSeconds) =>
          audioEngine.getTargetPerformanceTimeMilliseconds(playbackTimeSeconds),
      },
      onClockUnavailable: () => {
        if (pendingStartRef.current) {
          pendingStartRef.current.cancelled = true;
        }
        pendingStartRef.current = null;
        audioEngine.stop();
        visualScheduler.clear();
        setPlaybackState((previousState) => ({
          ...previousState,
          activeBeatIndex: INITIAL_METRONOME_PLAYBACK_STATE.activeBeatIndex,
          status: "idle",
        }));
        setErrorMessage("Playback stopped unexpectedly. Please start again.");
        if (import.meta.env.DEV) {
          console.warn("useMetronome: active clock became unavailable, playback stopped.");
        }
      },
      onBeatScheduled: (
        scheduledBeatIndex,
        playbackTimeSeconds,
        targetPerformanceTimeMilliseconds,
      ) => {
        audioEngine.scheduleClickSound(playbackTimeSeconds, scheduledBeatIndex);
        visualScheduler.scheduleBeat(scheduledBeatIndex, targetPerformanceTimeMilliseconds);
      },
    });
    audioEngineRef.current = audioEngine;
    beatSchedulerRef.current = beatScheduler;
    visualSchedulerRef.current = visualScheduler;

    const stopPlaybackForPageLifecycle = () => {
      audioEngine.stop();
      beatScheduler.stop();
      visualScheduler.clear();
      if (pendingStartRef.current) {
        pendingStartRef.current.cancelled = true;
      }
      pendingStartRef.current = null;
      setErrorMessage(null);
      setPlaybackState((previousState) => ({
        ...previousState,
        activeBeatIndex: INITIAL_METRONOME_PLAYBACK_STATE.activeBeatIndex,
        status: "idle",
      }));
    };
    const stopPlaybackWhenHidden = () => {
      if (document.visibilityState === "hidden") {
        stopPlaybackForPageLifecycle();
      }
    };

    document.addEventListener("visibilitychange", stopPlaybackWhenHidden);
    window.addEventListener("pagehide", stopPlaybackForPageLifecycle);

    return () => {
      document.removeEventListener("visibilitychange", stopPlaybackWhenHidden);
      window.removeEventListener("pagehide", stopPlaybackForPageLifecycle);
      visualScheduler.clear();
      beatScheduler.stop();
      beatSchedulerRef.current = null;
      visualSchedulerRef.current = null;
      if (pendingStartRef.current) {
        pendingStartRef.current.cancelled = true;
      }
      pendingStartRef.current = null;
      void audioEngine.dispose();
      audioEngineRef.current = null;
    };
  }, []);

  function setTempoBpm(candidateTempoBpm: number, options?: { syncInputValue?: boolean }) {
    const clampedTempoBpm = Math.min(
      TEMPO_BPM_RANGE.max,
      Math.max(TEMPO_BPM_RANGE.min, candidateTempoBpm),
    );
    if (Number.isNaN(clampedTempoBpm)) {
      return;
    }
    setPlaybackState((previousState) => ({
      ...previousState,
      tempoBpm: clampedTempoBpm,
    }));
    if (options?.syncInputValue !== false) {
      setTempoInputValue(String(clampedTempoBpm));
    }
    beatSchedulerRef.current?.setTempoBpm(clampedTempoBpm);
  }

  function setBeatsPerBarCount(candidateBeatsPerBar: number) {
    if (!Number.isInteger(candidateBeatsPerBar) || candidateBeatsPerBar < MIN_BEATS_PER_BAR) {
      return;
    }
    visualSchedulerRef.current?.clear();
    setPlaybackState((previousState) => ({
      ...previousState,
      beatsPerBar: candidateBeatsPerBar,
      activeBeatIndex: INITIAL_METRONOME_PLAYBACK_STATE.activeBeatIndex,
    }));
    beatSchedulerRef.current?.setBeatsPerBar(candidateBeatsPerBar);
  }

  async function startPlayback() {
    const scheduler = beatSchedulerRef.current;
    const audioEngine = audioEngineRef.current;
    if (!scheduler || !audioEngine || pendingStartRef.current) {
      return false;
    }
    if (scheduler.getIsRunning()) {
      return true;
    }

    const request = { cancelled: false };
    pendingStartRef.current = request;
    setErrorMessage(null);
    setPlaybackState((previousState) => ({ ...previousState, status: "starting" }));

    let didStart = false;
    try {
      const audioContext = await audioEngine.prepare();
      if (request.cancelled) {
        return false;
      }
      if (audioContext) {
        didStart = scheduler.start(audioContext.currentTime);
      }
    } catch {
      // Rejected audio setup is handled like an unavailable audio device below.
      didStart = false;
    }

    if (request.cancelled) {
      return false;
    }
    pendingStartRef.current = null;

    if (!didStart) {
      scheduler.stop();
      audioEngineRef.current?.stop();
      visualSchedulerRef.current?.clear();
      setErrorMessage("Audio output is unavailable. Please try again.");
    }
    setPlaybackState((previousState) => ({
      ...previousState,
      status: didStart ? "running" : "idle",
      activeBeatIndex: INITIAL_METRONOME_PLAYBACK_STATE.activeBeatIndex,
    }));
    return didStart;
  }

  function stopPlayback() {
    audioEngineRef.current?.stop();
    beatSchedulerRef.current?.stop();
    visualSchedulerRef.current?.clear();
    if (pendingStartRef.current) {
      pendingStartRef.current.cancelled = true;
    }
    pendingStartRef.current = null;
    setErrorMessage(null);
    setPlaybackState((previousState) => ({
      ...previousState,
      activeBeatIndex: INITIAL_METRONOME_PLAYBACK_STATE.activeBeatIndex,
      status: "idle",
    }));
  }

  function updateTempoInputValue(nextTempoInputValue: string) {
    setTempoInputValue(nextTempoInputValue);
    if (nextTempoInputValue === "") {
      return;
    }

    const candidateTempoBpm = Number(nextTempoInputValue);
    if (Number.isNaN(candidateTempoBpm)) {
      return;
    }

    if (candidateTempoBpm < TEMPO_BPM_RANGE.min || candidateTempoBpm > TEMPO_BPM_RANGE.max) {
      return;
    }

    setTempoBpm(candidateTempoBpm, { syncInputValue: false });
  }

  function commitTempoInput() {
    if (tempoInputValue === "") {
      setTempoInputValue(String(playbackState.tempoBpm));
      return;
    }

    const candidateTempoBpm = Number(tempoInputValue);
    if (Number.isNaN(candidateTempoBpm)) {
      setTempoInputValue(String(playbackState.tempoBpm));
      return;
    }

    setTempoBpm(candidateTempoBpm);
  }

  return {
    playbackState,
    tempoInputValue,
    errorMessage,
    setTempoBpm,
    setTempoInputValue: updateTempoInputValue,
    setBeatsPerBar: setBeatsPerBarCount,
    commitTempoInput,
    startPlayback,
    stopPlayback,
  };
};
