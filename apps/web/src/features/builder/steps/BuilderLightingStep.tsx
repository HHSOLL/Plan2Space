import { BUILDER_LIGHTING_OPTIONS } from "../constants";
import type { BuilderLightingMode } from "../types";

type BuilderLightingStepProps = {
  lightingMode: BuilderLightingMode;
  onLightingModeChange: (mode: BuilderLightingMode) => void;
};

export function BuilderLightingStep({
  lightingMode,
  onLightingModeChange
}: BuilderLightingStepProps) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        {BUILDER_LIGHTING_OPTIONS.map((option) => {
          const isActive = lightingMode === option.id;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onLightingModeChange(option.id)}
              className={`rounded-[24px] border px-5 py-5 text-left transition ${
                isActive
                  ? "border-[#171411] bg-[#171411] text-white shadow-[0_18px_34px_rgba(23,20,17,0.18)]"
                  : "border-black/10 bg-[#faf8f4] text-[#1f1b16] hover:border-black/20 hover:bg-white"
              }`}
            >
              <div className="text-[10px] font-bold uppercase tracking-[0.16em]">
                {option.id === "direct" ? "Direct Lighting" : "Indirect Lighting"}
              </div>
              <div className="mt-3 text-xl font-black tracking-[-0.03em]">{option.name}</div>
              <p className={`mt-3 text-sm leading-6 ${isActive ? "text-white/82" : "text-[#5d554a]"}`}>
                {option.description}
              </p>
              <p className={`mt-3 text-xs leading-5 ${isActive ? "text-white/68" : "text-[#84796d]"}`}>
                {option.detail}
              </p>
            </button>
          );
        })}
      </div>

      <div className="rounded-[22px] border border-black/10 bg-[#fbfaf7] p-5">
        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7a7064]">Preview Note</div>
        <p className="mt-3 text-sm leading-6 text-[#5d554a]">
          {lightingMode === "direct"
            ? "직접등은 천장 광원 포인트와 바닥으로 떨어지는 빔을 함께 보여줍니다."
            : "간접등은 광원 노출을 줄이고 천장 근처의 부드러운 확산광으로 공간 톤을 만듭니다."}
        </p>
      </div>
    </div>
  );
}
