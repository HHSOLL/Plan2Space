"use client";

type StudioMetricItem = {
  label: string;
  value: string;
};

type StudioMetricGridProps = {
  items: StudioMetricItem[];
  gridClassName?: string;
  cardClassName?: string;
  labelClassName?: string;
  valueClassName?: string;
};

export function StudioMetricGrid({
  items,
  gridClassName = "grid grid-cols-2 gap-3",
  cardClassName = "rounded-[18px] border border-white/10 bg-white/[0.04] p-3",
  labelClassName = "text-[10px] uppercase tracking-[0.16em] text-white/35",
  valueClassName = "mt-2 text-lg font-medium text-white"
}: StudioMetricGridProps) {
  return (
    <div className={gridClassName}>
      {items.map((item) => (
        <div key={item.label} className={cardClassName}>
          <div className={labelClassName}>{item.label}</div>
          <div className={valueClassName}>{item.value}</div>
        </div>
      ))}
    </div>
  );
}
