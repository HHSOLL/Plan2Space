import type { BuilderDimensionControl, BuilderTemplateId } from "../../../lib/builder/templates";

type BuilderDimensionsStepProps = {
  unit: "ft" | "cm";
  templateId: BuilderTemplateId;
  controls: BuilderDimensionControl[];
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

function ShapeGuide({ templateId }: { templateId: BuilderTemplateId }) {
  const fill = "#ffffff";
  const stroke = "#171411";
  const common = {
    fill,
    stroke,
    strokeWidth: 4,
    strokeLinejoin: "round" as const
  };

  const shapes: Record<BuilderTemplateId, JSX.Element> = {
    "rect-studio": <rect x="40" y="32" width="100" height="74" {...common} />,
    "l-shape": <path d="M40 106V56H92V32H140V106Z" {...common} />,
    "cut-shape": <path d="M40 106V32H140V76L108 106Z" {...common} />,
    "t-shape": <path d="M40 32H140V62H104V106H76V62H40Z" {...common} />,
    "u-shape": <path d="M40 32H140V106H108V70H72V106H40Z" {...common} />,
    "slanted-shape": <path d="M40 50L58 32H122L140 50V106H40Z" {...common} />
  };

  return (
    <div className="flex justify-center pt-2">
      <svg viewBox="0 0 180 140" className="h-[120px] w-[150px]" aria-hidden>
        {shapes[templateId]}
        <circle cx="40" cy="32" r="7" fill="#ffffff" stroke="#171411" strokeWidth="2" />
      </svg>
    </div>
  );
}

export function BuilderDimensionsStep({
  unit,
  templateId,
  controls,
  onUnitChange,
  onControlChange
}: BuilderDimensionsStepProps) {
  return (
    <div className="space-y-7">
      <ShapeGuide templateId={templateId} />

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
