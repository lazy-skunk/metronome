export type MetronomeBeatSchedulerClock = {
  getCurrentTimeSeconds: () => number | null;
  getTargetPerformanceTimeMilliseconds: (playbackTimeSeconds: number) => number | null;
};

type MetronomeBeatSchedulerOptions = {
  tempoBpm: number;
  beatsPerBar: number;
  clock: MetronomeBeatSchedulerClock;
  lookaheadMilliseconds?: number;
  scheduleAheadSeconds?: number;
  onClockUnavailable?: () => void;
  onBeatScheduled?: (
    beatIndex: number,
    playbackTimeSeconds: number,
    targetPerformanceTimeMilliseconds: number,
  ) => void;
};

const LOOKAHEAD_MILLISECONDS = 25;
const SCHEDULE_AHEAD_SECONDS = 0.1;
const DOWNBEAT_INDEX = 0;

export class MetronomeBeatScheduler {
  private schedulerIntervalId: ReturnType<typeof setInterval> | null = null;

  private readonly clock: MetronomeBeatSchedulerClock;
  private readonly lookaheadMilliseconds: number;
  private readonly scheduleAheadSeconds: number;
  private readonly onClockUnavailable?: () => void;
  private readonly onBeatScheduled?: (
    beatIndex: number,
    playbackTimeSeconds: number,
    targetPerformanceTimeMilliseconds: number,
  ) => void;

  private tempoBpm: number;
  private beatsPerBar: number;
  private currentBeatIndex = DOWNBEAT_INDEX;
  private nextBeatTimeSeconds = 0;

  constructor(options: MetronomeBeatSchedulerOptions) {
    this.tempoBpm = options.tempoBpm;
    this.beatsPerBar = options.beatsPerBar;
    this.clock = options.clock;
    this.lookaheadMilliseconds = options.lookaheadMilliseconds ?? LOOKAHEAD_MILLISECONDS;
    this.scheduleAheadSeconds = options.scheduleAheadSeconds ?? SCHEDULE_AHEAD_SECONDS;
    this.onClockUnavailable = options.onClockUnavailable;
    this.onBeatScheduled = options.onBeatScheduled;
  }

  public setTempoBpm(nextTempoBpm: number) {
    this.tempoBpm = nextTempoBpm;
  }

  public setBeatsPerBar(nextBeatsPerBar: number) {
    this.beatsPerBar = nextBeatsPerBar;
    this.currentBeatIndex = DOWNBEAT_INDEX;
  }

  public getIsRunning() {
    return this.schedulerIntervalId !== null;
  }

  public start(currentTimeSeconds: number) {
    if (this.getIsRunning()) {
      return true;
    }

    this.currentBeatIndex = DOWNBEAT_INDEX;
    this.nextBeatTimeSeconds = currentTimeSeconds;
    this.schedulerIntervalId = setInterval(this.schedulePendingBeats, this.lookaheadMilliseconds);
    try {
      this.schedulePendingBeats();
      return this.getIsRunning();
    } catch (error) {
      this.stop();
      throw error;
    }
  }

  public stop() {
    if (this.schedulerIntervalId !== null) {
      clearInterval(this.schedulerIntervalId);
      this.schedulerIntervalId = null;
    }

    this.currentBeatIndex = DOWNBEAT_INDEX;
    this.nextBeatTimeSeconds = 0;
  }

  private readonly schedulePendingBeats = () => {
    const currentTimeSeconds = this.clock.getCurrentTimeSeconds();
    if (currentTimeSeconds === null) {
      this.stop();
      this.onClockUnavailable?.();
      return;
    }

    while (this.nextBeatTimeSeconds < currentTimeSeconds + this.scheduleAheadSeconds) {
      const beatIndexToSchedule = this.currentBeatIndex;
      const targetPerformanceTimeMilliseconds = this.clock.getTargetPerformanceTimeMilliseconds(
        this.nextBeatTimeSeconds,
      );
      if (targetPerformanceTimeMilliseconds === null) {
        this.stop();
        this.onClockUnavailable?.();
        return;
      }

      this.onBeatScheduled?.(
        beatIndexToSchedule,
        this.nextBeatTimeSeconds,
        targetPerformanceTimeMilliseconds,
      );

      const secondsPerBeat = 60 / this.tempoBpm;
      this.nextBeatTimeSeconds += secondsPerBeat;
      this.currentBeatIndex = (beatIndexToSchedule + 1) % this.beatsPerBar;
    }
  };
}
