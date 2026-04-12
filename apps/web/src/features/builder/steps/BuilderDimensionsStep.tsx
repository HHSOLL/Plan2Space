type BuilderDimensionsStepProps = {
  templateId: string;
  width: number;
  depth: number;
  nookWidth: number;
  nookDepth: number;
  onWidthChange: (value: number) => void;
  onDepthChange: (value: number) => void;
  onNookWidthChange: (value: number) => void;
  onNookDepthChange: (value: number) => void;
};

export function BuilderDimensionsStep({
  templateId,
  width,
  depth,
  nookWidth,
  nookDepth,
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
          <span>{width.toFixed(1)} m</span>
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
          <span>{depth.toFixed(1)} m</span>
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

      {templateId === "corner-suite" ? (
        <>
          <div>
            <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8b7f72]">
              <span>돌출부 가로</span>
              <span>{nookWidth.toFixed(1)} m</span>
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
              <span>{nookDepth.toFixed(1)} m</span>
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
    </div>
  );
}
