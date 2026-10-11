import { TEMPO_BPM_RANGE, useMetronome } from "./useMetronome";
const BEATS_PER_BAR_OPTIONS = [2, 3, 4, 5, 6] as const;
const DOWNBEAT_INDEX = 0;
const TEMPO_COLOR_MIN_BPM = 120;
const TEMPO_COLOR_MAX_BPM = 240;
const HSL_RED_HUE = 0;
const HSL_GREEN_HUE = 120;

export default function Metronome() {
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

    let beatColor = "bg-gray-700/25";
    if (isActive) {
      beatColor = isDownbeat ? "bg-red-500" : "bg-green-500";
    }

    return <div key={index} className={`h-3 w-3 rounded-full ${beatColor}`} />;
  });

  return (
    <section className="flex min-h-screen flex-col items-center justify-center px-9">
      <h1 className="mb-3 text-3xl font-bold">Metronome</h1>

      <div className="w-full max-w-xl rounded bg-gray-800/50 p-6">
        <div className="flex flex-col items-center gap-3">
          <label className="flex items-center gap-3">
            <input
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
              className="rounded bg-gray-700/25 text-center text-3xl font-bold"
            />
            <span>BPM</span>
          </label>

          <input
            type="range"
            aria-label="BPM"
            min={TEMPO_BPM_RANGE.min}
            max={TEMPO_BPM_RANGE.max}
            value={tempoBpm}
            onChange={(event) => setTempoBpm(Number(event.target.value))}
            className="mb-3 w-full"
            style={{ accentColor: tempoSliderAccentColor }}
          />

          <label className="flex items-center gap-3">
            <select
              value={beatsPerBar}
              onChange={(event) => setBeatsPerBar(Number(event.target.value))}
              className="rounded bg-gray-700/25 px-6 text-3xl font-bold"
            >
              {BEATS_PER_BAR_OPTIONS.map((value) => (
                <option key={value} value={value} className="bg-gray-800">
                  {value}
                </option>
              ))}
            </select>
            <span>Beats / Bar</span>
          </label>

          <div className="mb-3 flex gap-6">{beatIndicators}</div>

          {errorMessage && <div className="text-sm text-red-500">{errorMessage}</div>}

          <>
            {status !== "running" && (
              <button
                type="button"
                disabled={status === "starting"}
                onClick={() => {
                  void startPlayback();
                }}
                className="rounded-full bg-green-700/50 px-3 py-1 transition hover:bg-green-700 active:scale-95"
              >
                {status === "starting" ? "Starting…" : "Start"}
              </button>
            )}
            {status !== "idle" && (
              <button
                type="button"
                onClick={stopPlayback}
                className="rounded-full bg-red-700/50 px-3 py-1 transition hover:bg-red-700 active:scale-95"
              >
                Stop
              </button>
            )}
          </>
        </div>
      </div>
    </section>
  );
}
