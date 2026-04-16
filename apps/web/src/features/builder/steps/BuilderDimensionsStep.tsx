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

function DimensionControl({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: "ft" | "cm";
  onChange: (value: number) => void;
}) {
  return (
    <label className="block space-y-2">
      <div className="flex items-center justify-between text-sm font-semibold text-[#2b2621]">
        <span>{label}</span>
        <span className="text-[#7c7266]">{formatDimension(value, unit)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 w-full cursor-pointer accent-[#171411]"
      />
    </label>
  );
}

function MiniShapePreview({ supportsSecondaryDimensions }: { supportsSecondaryDimensions: boolean }) {
  return (
    <div className="flex justify-center pt-2">
      <svg viewBox="0 0 180 140" className="h-[120px] w-[150px]" aria-hidden>
        {supportsSecondaryDimensions ? (
          <path d="M40 100V40H132V78H100V100Z" fill="#ffffff" stroke="#171411" strokeWidth="4" strokeLinejoin="round" />
        ) : (
          <rect x="40" y="40" width="92" height="60" fill="#ffffff" stroke="#171411" strokeWidth="4" />
        )}
        <line x1="40" y1="40" x2="40" y2="100" stroke="#f4d000" strokeWidth="4" />
        <circle cx="34" cy="72" r="11" fill="#ffffff" stroke="#171411" strokeWidth="2" />
        <path d="M33 67.5V77.5M33 67.5C29.5 67.5 27 70 27 73.5M33 67.5C36.5 67.5 39 70 39 73.5" stroke="#171411" strokeLinecap="round" strokeWidth="2" />
        <path d="M18 73H24M42 73H48" stroke="#171411" strokeLinecap="round" strokeWidth="2" />
      </svg>
    </div>
  );
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
    <div className="space-y-7">
      <MiniShapePreview supportsSecondaryDimensions={supportsSecondaryDimensions} />

      <div className="space-y-4">
        <DimensionControl label="가로" value={width} min={4} max={10} step={0.2} unit={unit} onChange={onWidthChange} />
        <DimensionControl label="세로" value={depth} min={3.6} max={8} step={0.2} unit={unit} onChange={onDepthChange} />

        {supportsSecondaryDimensions ? (
          <>
            <DimensionControl
              label="보조 가로"
              value={nookWidth}
              min={1.6}
              max={4}
              step={0.1}
              unit={unit}
              onChange={onNookWidthChange}
            />
            <DimensionControl
              label="보조 세로"
              value={nookDepth}
              min={1.4}
              max={3.6}
              step={0.1}
              unit={unit}
              onChange={onNookDepthChange}
            />
          </>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-full border border-black/15 bg-white">
        <div className="grid grid-cols-2">
          <button
            type="button"
            onClick={() => onUnitChange("ft")}
            className={`h-12 text-sm font-semibold transition ${
              unit === "ft" ? "bg-white text-[#15120f]" : "bg-transparent text-[#6f665b]"
            }`}
          >
            피트
          </button>
          <button
            type="button"
            onClick={() => onUnitChange("cm")}
            className={`h-12 border-l border-black/10 text-sm font-semibold transition ${
              unit === "cm" ? "bg-white text-[#15120f]" : "bg-transparent text-[#6f665b]"
            }`}
          >
            센티미터
          </button>
        </div>
      </div>
    </div>
  );
}
