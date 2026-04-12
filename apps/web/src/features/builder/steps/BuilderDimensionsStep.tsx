type BuilderDimensionsStepProps = {
  unit: "ft" | "cm";
  supportsSecondaryDimensions: boolean;
  width: number;
  depth: number;
  nookWidth: number;
  nookDepth: number;
  onUnitChange: (nextUnit: "ft" | "cm") => void;
  onWidthChange: (value: number) => void;
  onDepthChange: (value: number) => void;
  onNookWidthChange: (value: number) => void;
  onNookDepthChange: (value: number) => void;
};

function formatDimension(meters: number, unit: "ft" | "cm") {
  if (unit === "ft") {
    return `${(meters * 3.28084).toFixed(1)} ft`;
  }
  return `${Math.round(meters * 100)} cm`;
}

export function BuilderDimensionsStep({
  unit,
  supportsSecondaryDimensions,
  width,
  depth,
  nookWidth,
  nookDepth,
  onUnitChange,
  onWidthChange,
  onDepthChange,
  onNookWidthChange,
  onNookDepthChange
}: BuilderDimensionsStepProps) {
  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8b7f72]">
          <span>가로 길이</span>
          <span>{formatDimension(width, unit)}</span>
        </div>
        <input
          type="range"
          min={4}
          max={10}
          step={0.2}
          value={width}
          onChange={(event) => onWidthChange(Number(event.target.value))}
          className="mt-3 w-full"
        />
      </div>

      <div>
        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8b7f72]">
          <span>세로 길이</span>
          <span>{formatDimension(depth, unit)}</span>
        </div>
        <input
          type="range"
          min={3.6}
          max={8}
          step={0.2}
          value={depth}
          onChange={(event) => onDepthChange(Number(event.target.value))}
          className="mt-3 w-full"
        />
      </div>

      {supportsSecondaryDimensions ? (
        <>
          <div>
            <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8b7f72]">
              <span>돌출부 가로</span>
              <span>{formatDimension(nookWidth, unit)}</span>
            </div>
            <input
              type="range"
              min={1.6}
              max={4}
              step={0.1}
              value={nookWidth}
              onChange={(event) => onNookWidthChange(Number(event.target.value))}
              className="mt-3 w-full"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8b7f72]">
              <span>돌출부 세로</span>
              <span>{formatDimension(nookDepth, unit)}</span>
            </div>
            <input
              type="range"
              min={1.4}
              max={3.6}
              step={0.1}
              value={nookDepth}
              onChange={(event) => onNookDepthChange(Number(event.target.value))}
              className="mt-3 w-full"
            />
          </div>
        </>
      ) : null}

      <div className="rounded-full border border-black/10 bg-[#fbf8f3] p-1">
        <div className="grid grid-cols-2 gap-1 text-[11px] font-semibold">
          <button
            type="button"
            onClick={() => onUnitChange("ft")}
            className={`rounded-full px-3 py-2 transition ${
              unit === "ft" ? "bg-[#171411] text-white" : "text-[#5a4f44] hover:bg-white"
            }`}
          >
            피트
          </button>
          <button
            type="button"
            onClick={() => onUnitChange("cm")}
            className={`rounded-full px-3 py-2 transition ${
              unit === "cm" ? "bg-[#171411] text-white" : "text-[#5a4f44] hover:bg-white"
            }`}
          >
            센티미터
          </button>
        </div>
      </div>
    </div>
  );
}
