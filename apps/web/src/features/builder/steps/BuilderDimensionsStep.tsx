import type { Vector2 } from "../../../lib/stores/useSceneStore";
import type { BuilderDimensionControl } from "../../../lib/builder/templates";

type BuilderDimensionsStepProps = {
  unit: "ft" | "cm";
  controls: BuilderDimensionControl[];
  outline: Vector2[];
  onUnitChange: (nextUnit: "ft" | "cm") => void;
  onControlChange: (id: BuilderDimensionControl["id"], value: number) => void;
};

function formatDimension(meters: number, unit: "ft" | "cm") {
  if (unit === "ft") {
    return `${(meters * 3.28084).toFixed(1)} ft`;
  }

  return `${Math.round(meters * 100)} cm`;
}

function DimensionControl({
  control,
  unit,
  onChange
}: {
  control: BuilderDimensionControl;
  unit: "ft" | "cm";
  onChange: (value: number) => void;
}) {
  return (
    <label className="block space-y-2">
      <div className="flex items-center justify-between text-sm font-semibold text-[#2b2621]">
        <span>{control.label}</span>
        <span className="text-[#7c7266]">{formatDimension(control.value, unit)}</span>
      </div>
      <input
        type="range"
        min={control.min}
        max={control.max}
        step={control.step}
        value={control.value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 w-full cursor-pointer accent-[#171411]"
      />
      {control.hint ? <p className="text-xs leading-5 text-[#8a8177]">{control.hint}</p> : null}
    </label>
  );
}

function buildGuidePath(outline: Vector2[]) {
  const fallback: Vector2[] = [
    [0, 0],
    [6.4, 0],
    [6.4, 4.8],
    [0, 4.8]
  ];
  const source = outline.length >= 3 ? outline : fallback;
  const minX = Math.min(...source.map(([x]) => x));
  const maxX = Math.max(...source.map(([x]) => x));
  const minY = Math.min(...source.map(([, y]) => y));
  const maxY = Math.max(...source.map(([, y]) => y));
  const width = Math.max(maxX - minX, 0.01);
  const height = Math.max(maxY - minY, 0.01);
  const viewportWidth = 100;
  const viewportHeight = 74;
  const scale = Math.min(viewportWidth / width, viewportHeight / height);
  const offsetX = (180 - width * scale) / 2;
  const offsetY = (140 - height * scale) / 2;

  const points = source.map(([x, y]) => [offsetX + (x - minX) * scale, offsetY + (maxY - y) * scale] as const);
  const path = points
    .map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(" ")
    .concat(" Z");

  return { path, points };
}

function ShapeGuide({ outline }: { outline: Vector2[] }) {
  const guide = buildGuidePath(outline);
  return (
    <div className="flex justify-center pt-2">
      <svg viewBox="0 0 180 140" className="h-[120px] w-[150px]" aria-hidden>
        <path d={guide.path} fill="#ffffff" stroke="#171411" strokeWidth="4" strokeLinejoin="round" />
        {guide.points.map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="6" fill="#ffffff" stroke="#171411" strokeWidth="2" />
        ))}
      </svg>
    </div>
  );
}

export function BuilderDimensionsStep({
  unit,
  controls,
  outline,
  onUnitChange,
  onControlChange
}: BuilderDimensionsStepProps) {
  return (
    <div className="space-y-7">
      <ShapeGuide outline={outline} />

      <div className="space-y-4">
        {controls.map((control) => (
          <DimensionControl
            key={control.id}
            control={control}
            unit={unit}
            onChange={(value) => onControlChange(control.id, value)}
          />
        ))}
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
