import { TEMPO_BPM_RANGE, useTempoKeeper } from "../hooks/useTempoKeeper";
const BEATS_PER_BAR_OPTIONS = [2, 3, 4, 5, 6] as const;
const DOWNBEAT_INDEX = 0;
const TEMPO_COLOR_MIN_BPM = 60;
const TEMPO_COLOR_MAX_BPM = 210;
const HSL_RED_HUE = 0;
const HSL_GREEN_HUE = 120;

export default function TempoKeeper() {
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
  } = useTempoKeeper();
  const { tempoBpm, beatsPerBar, status, activeBeatIndex } = playbackState;

  const tempoProgress = Math.min(
    Math.max((tempoBpm - TEMPO_COLOR_MIN_BPM) / (TEMPO_COLOR_MAX_BPM - TEMPO_COLOR_MIN_BPM), 0),
    1,
  );
  const tempoHue = HSL_GREEN_HUE - (HSL_GREEN_HUE - HSL_RED_HUE) * tempoProgress;
  const tempoSliderAccentColor = `hsl(${tempoHue} 75% 50%)`;

  const beatIndicators = Array.from({ length: beatsPerBar }, (_, index) => {
    const isActive = status === "running" && activeBeatIndex === index;
    const isDownbeat = index === DOWNBEAT_INDEX;

    let beatColor = "bg-gray-500";
    if (isActive) {
      beatColor = isDownbeat ? "bg-red-500" : "bg-green-500";
    }

    return <div key={index} className={`h-10 w-10 rounded-full ${beatColor}`} />;
  });

  return (
    <main className="flex min-h-screen flex-col items-center justify-center mx-9">
      <h1 className="mb-3 text-center text-3xl font-bold">Tempo Keeper</h1>

      <div className="flex w-full flex-col rounded border p-6">
        <div className="flex flex-col items-center justify-center gap-3">
          <label className="flex items-center justify-center gap-3">
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
              className="rounded border text-center text-3xl font-bold"
            />
            <span>BPM</span>
          </label>

          <input
            type="range"
            min={TEMPO_BPM_RANGE.min}
            max={TEMPO_BPM_RANGE.max}
            value={tempoBpm}
            onChange={(event) => setTempoBpm(Number(event.target.value))}
            className="mb-3 w-full"
            style={{ accentColor: tempoSliderAccentColor }}
          />

          <label className="flex items-center justify-center gap-3">
            <select
              value={beatsPerBar}
              onChange={(event) => setBeatsPerBar(Number(event.target.value))}
              className="rounded border bg-zinc-900 px-6 text-3xl font-bold text-zinc-100"
            >
              {BEATS_PER_BAR_OPTIONS.map((value) => (
                <option key={value} value={value} className="bg-zinc-900 text-zinc-100">
                  {value}
                </option>
              ))}
            </select>
            <span>Beats / Bar</span>
          </label>

          <div className="mb-3 flex items-center justify-center gap-6">{beatIndicators}</div>

          {errorMessage && (
            <div className="max-w-md rounded-2xl bg-rose-100 px-4 py-3 text-sm font-medium text-rose-700">
              {errorMessage}
            </div>
          )}

          <div className="flex items-center justify-center">
            {status !== "running" && (
              <button
                type="button"
                disabled={status === "starting"}
                onClick={() => {
                  void startPlayback();
                }}
                className="rounded-full border border-green-500 px-4.5 py-1 text-xl text-green-500"
              >
                {status === "starting" ? "Starting…" : "Start"}
              </button>
            )}
            {status !== "idle" && (
              <button
                type="button"
                onClick={stopPlayback}
                className="rounded-full border border-red-500 px-4.5 py-1 text-xl text-red-500"
              >
                Stop
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
