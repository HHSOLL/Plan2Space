"use client";

export type PrecisionSurfaceLockInfo = {
  supportLabel: string;
  surfaceLabel: string;
  sizeMm: [number, number];
  usableSizeMm: [number, number];
  marginMm: [number, number];
  localOffsetMm: [number, number];
  topMm: number;
};

type PrecisionSurfaceMicroViewProps = {
  surfaceLockInfo: PrecisionSurfaceLockInfo;
  variant?: "panel" | "compact";
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function resolveSurfaceFrame(sizeMm: [number, number]) {
  const [width, depth] = sizeMm;
  const safeWidth = Math.max(width, 1);
  const safeDepth = Math.max(depth, 1);
  const aspect = safeWidth / safeDepth;

  if (aspect >= 1) {
    const frameWidth = 88;
    const frameHeight = frameWidth / aspect;
    return {
      x: (100 - frameWidth) / 2,
      y: (100 - frameHeight) / 2,
      width: frameWidth,
      height: frameHeight
    };
  }

  const frameHeight = 88;
  const frameWidth = frameHeight * aspect;
  return {
    x: (100 - frameWidth) / 2,
    y: (100 - frameHeight) / 2,
    width: frameWidth,
    height: frameHeight
  };
}

export function PrecisionSurfaceMicroView({
  surfaceLockInfo,
  variant = "panel"
}: PrecisionSurfaceMicroViewProps) {
  const [surfaceWidth, surfaceDepth] = surfaceLockInfo.sizeMm;
  const [marginX, marginZ] = surfaceLockInfo.marginMm;
  const [offsetX, offsetZ] = surfaceLockInfo.localOffsetMm;
  const [usableWidth, usableDepth] = surfaceLockInfo.usableSizeMm;
  const frame = resolveSurfaceFrame(surfaceLockInfo.sizeMm);
  const markerX = frame.x + ((offsetX + surfaceWidth / 2) / Math.max(surfaceWidth, 1)) * frame.width;
  const markerY = frame.y + ((surfaceDepth / 2 - offsetZ) / Math.max(surfaceDepth, 1)) * frame.height;
  const usableX = frame.x + (marginX / Math.max(surfaceWidth, 1)) * frame.width;
  const usableY = frame.y + (marginZ / Math.max(surfaceDepth, 1)) * frame.height;
  const usableFrameWidth = (usableWidth / Math.max(surfaceWidth, 1)) * frame.width;
  const usableFrameHeight = (usableDepth / Math.max(surfaceDepth, 1)) * frame.height;
  const panelClassName =
    variant === "compact"
      ? "rounded-[16px] border border-emerald-200/80 bg-emerald-50/60 p-2.5"
      : "rounded-[16px] border border-black/10 bg-[#faf9f7] p-3";
  const svgClassName = variant === "compact" ? "h-28 w-full" : "h-36 w-full";

  return (
    <div className={panelClassName}>
      <svg
        viewBox="0 0 100 100"
        className={svgClassName}
        role="img"
        aria-label={`${surfaceLockInfo.surfaceLabel} micro view`}
      >
        <defs>
          <linearGradient id={`surface-${variant}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f7efe2" />
            <stop offset="100%" stopColor="#eadfcd" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="96" height="96" rx="12" fill="#f5f1ea" />
        <rect
          x={frame.x}
          y={frame.y}
          width={frame.width}
          height={frame.height}
          rx="8"
          fill={`url(#surface-${variant})`}
          stroke="#8a7d6e"
          strokeWidth="1.8"
        />
        <rect
          x={usableX}
          y={usableY}
          width={Math.max(usableFrameWidth, 0)}
          height={Math.max(usableFrameHeight, 0)}
          rx="6"
          fill="none"
          stroke="#2e8b57"
          strokeWidth="1.6"
          strokeDasharray="4 3"
        />
        <line
          x1={frame.x + frame.width / 2}
          y1={frame.y}
          x2={frame.x + frame.width / 2}
          y2={frame.y + frame.height}
          stroke="#b8ad9f"
          strokeWidth="1"
          strokeDasharray="2 3"
        />
        <line
          x1={frame.x}
          y1={frame.y + frame.height / 2}
          x2={frame.x + frame.width}
          y2={frame.y + frame.height / 2}
          stroke="#b8ad9f"
          strokeWidth="1"
          strokeDasharray="2 3"
        />
        <circle cx={clamp(markerX, frame.x, frame.x + frame.width)} cy={clamp(markerY, frame.y, frame.y + frame.height)} r="4.4" fill="#111316" />
        <circle cx={clamp(markerX, frame.x, frame.x + frame.width)} cy={clamp(markerY, frame.y, frame.y + frame.height)} r="7.4" fill="none" stroke="#111316" strokeOpacity="0.18" strokeWidth="2" />
      </svg>

      <div className="mt-2 flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6f665a]">
        <span>X {offsetX} mm</span>
        <span>Z {offsetZ} mm</span>
      </div>
    </div>
  );
}
