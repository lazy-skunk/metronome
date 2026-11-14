import { TEMPO_BPM_RANGE, useMetronome } from "./useMetronome";
const BEATS_PER_BAR_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1);
const DOWNBEAT_INDEX = 0;
const TEMPO_COLOR_MIN_BPM = 60;
const TEMPO_COLOR_MAX_BPM = 240;
const HSL_RED_HUE = 0;
const HSL_GREEN_HUE = 120;
const TEMPO_ADJUSTMENTS = [
  { delta: -10, color: "bg-green-100 text-green-900 dark:bg-green-900 dark:text-green-100" },
  { delta: -5, color: "bg-lime-100 text-lime-900 dark:bg-lime-900 dark:text-lime-100" },
  { delta: 5, color: "bg-orange-100 text-orange-900 dark:bg-orange-900 dark:text-orange-100" },
  { delta: 10, color: "bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100" },
] as const;

export function App() {
  const {
    playbackState,
    tempoInputValue,
    errorMessage,
    setBeatsPerBar,
    setTempoBpm,
    setTempoInputValue,
    commitTempoInput,
    startPlayback,
    stopPlayback,
  } = useMetronome();
  const { tempoBpm, beatsPerBar, status, activeBeatIndex } = playbackState;

  const tempoProgress = Math.min(
    Math.max((tempoBpm - TEMPO_COLOR_MIN_BPM) / (TEMPO_COLOR_MAX_BPM - TEMPO_COLOR_MIN_BPM), 0),
    1,
  );
  const tempoHue = HSL_GREEN_HUE - (HSL_GREEN_HUE - HSL_RED_HUE) * tempoProgress;
  const tempoSliderAccentColor = `hsl(${tempoHue} 100% 50%)`;

  const beatIndicators = Array.from({ length: beatsPerBar }, (_, index) => {
    const isActive = status === "running" && activeBeatIndex === index;
    const isDownbeat = index === DOWNBEAT_INDEX;

    let beatColor = "bg-foreground/3";
    if (isActive) {
      beatColor = isDownbeat ? "bg-red-500" : "bg-green-500";
    }

    return (
      <div
        key={index}
        className={`${beatColor} h-3 w-3 rounded-full motion-safe:transition-opacity motion-safe:starting:opacity-0`}
      />
    );
  });

  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <header>
        <h1 className="text-lg font-bold">
          <a href="#">Metronome</a>
        </h1>
      </header>

      <main className="bg-foreground/3 flex w-full max-w-xl flex-col items-center gap-4 rounded p-4">
        <div className="flex items-center gap-2">
          <input
            id="tempo-bpm"
            type="number"
            min={TEMPO_BPM_RANGE.min}
            max={TEMPO_BPM_RANGE.max}
            value={tempoInputValue}
            onChange={(event) => {
              setTempoInputValue(event.target.value);
            }}
            onBlur={commitTempoInput}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              }
            }}
            className="bg-foreground/3 hover:bg-foreground/6 rounded p-2 text-center text-3xl font-bold motion-safe:transition-colors"
          />
          <label htmlFor="tempo-bpm">BPM</label>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {TEMPO_ADJUSTMENTS.map(({ delta, color }) => (
            <button
              key={delta}
              type="button"
              disabled={
                tempoBpm + delta < TEMPO_BPM_RANGE.min || tempoBpm + delta > TEMPO_BPM_RANGE.max
              }
              onClick={() => setTempoBpm(tempoBpm + delta)}
              className={`${color} disabled:bg-foreground/3 disabled:text-foreground/50 dark:disabled:bg-foreground/3 dark:disabled:text-foreground/50 cursor-pointer rounded px-4 py-2 disabled:cursor-not-allowed disabled:active:translate-y-0 motion-safe:transition motion-safe:active:translate-y-px`}
            >
              {delta > 0 ? `+${delta}` : delta}
            </button>
          ))}
        </div>

        <div className="w-full">
          <label htmlFor="tempo-slider" className="sr-only">
            BPM
          </label>
          <input
            id="tempo-slider"
            type="range"
            min={TEMPO_BPM_RANGE.min}
            max={TEMPO_BPM_RANGE.max}
            value={tempoBpm}
            onChange={(event) => setTempoBpm(Number(event.target.value))}
            className="w-full"
            style={{ accentColor: tempoSliderAccentColor }}
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            id="beats-per-bar"
            value={beatsPerBar}
            onChange={(event) => setBeatsPerBar(Number(event.target.value))}
            className="bg-foreground/3 hover:bg-foreground/6 rounded p-2 motion-safe:transition-colors"
          >
            {BEATS_PER_BAR_OPTIONS.map((value) => (
              <option key={value} value={value} className="bg-background text-foreground">
                {value}
              </option>
            ))}
          </select>
          <label htmlFor="beats-per-bar">Beats / Bar</label>
        </div>

        <div className="flex gap-2">{beatIndicators}</div>

        <div role="alert" className="empty:absolute">
          {errorMessage && (
            <div className="text-red-500 motion-safe:transition-opacity motion-safe:starting:opacity-0">
              {errorMessage}
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {status !== "running" && (
            <button
              type="button"
              disabled={status === "starting"}
              onClick={() => {
                void startPlayback();
              }}
              className="disabled:bg-foreground/3 disabled:text-foreground/50 dark:disabled:bg-foreground/3 dark:disabled:text-foreground/50 cursor-pointer rounded bg-green-100 px-4 py-2 text-green-900 disabled:cursor-not-allowed disabled:active:translate-y-0 motion-safe:transition motion-safe:active:translate-y-px dark:bg-green-900 dark:text-green-100"
            >
              {status === "starting" ? "Starting…" : "Start"}
            </button>
          )}
          {status !== "idle" && (
            <button
              type="button"
              onClick={stopPlayback}
              className="cursor-pointer rounded bg-red-100 px-4 py-2 text-red-900 motion-safe:transition motion-safe:active:translate-y-px dark:bg-red-900 dark:text-red-100"
            >
              Stop
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
