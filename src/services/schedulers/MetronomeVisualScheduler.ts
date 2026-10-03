type MetronomeVisualSchedulerOptions = {
  onBeatActivated: (beatIndex: number) => void;
};

export class MetronomeVisualScheduler {
  private scheduledBeatTimeoutIds = new Set<number>();
  private scheduledBeatAnimationFrameIds = new Set<number>();

  private readonly onBeatActivated: (beatIndex: number) => void;

  constructor(options: MetronomeVisualSchedulerOptions) {
    this.onBeatActivated = options.onBeatActivated;
  }

  public scheduleBeat(beatIndex: number, targetPerformanceTimeMilliseconds: number) {
    let animationFrameId = 0;

    const checkFrame = () => {
      this.scheduledBeatAnimationFrameIds.delete(animationFrameId);
      if (performance.now() < targetPerformanceTimeMilliseconds) {
        animationFrameId = window.requestAnimationFrame(checkFrame);
        this.scheduledBeatAnimationFrameIds.add(animationFrameId);
        return;
      }
      this.onBeatActivated(beatIndex);
    };

    // Wait until the beat is due, then update on a rendering frame.
    const delayMilliseconds = Math.max(0, targetPerformanceTimeMilliseconds - performance.now());
    const timeoutId = window.setTimeout(() => {
      this.scheduledBeatTimeoutIds.delete(timeoutId);
      animationFrameId = window.requestAnimationFrame(checkFrame);
      this.scheduledBeatAnimationFrameIds.add(animationFrameId);
    }, delayMilliseconds);
    this.scheduledBeatTimeoutIds.add(timeoutId);
  }

  public clear() {
    for (const timeoutId of this.scheduledBeatTimeoutIds) {
      window.clearTimeout(timeoutId);
    }
    this.scheduledBeatTimeoutIds.clear();

    for (const animationFrameId of this.scheduledBeatAnimationFrameIds) {
      window.cancelAnimationFrame(animationFrameId);
    }
    this.scheduledBeatAnimationFrameIds.clear();
  }
}
