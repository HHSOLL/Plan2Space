import { Sparkles } from "lucide-react";
import type { BuilderStepMeta } from "./types";

type BuilderStepHeaderProps = {
  activeStep: BuilderStepMeta;
  steps: BuilderStepMeta[];
  stepIndex: number;
  onStepChange: (index: number) => void;
};

export function BuilderStepHeader({
  activeStep,
  steps,
  stepIndex,
  onStepChange
}: BuilderStepHeaderProps) {
  return (
    <>
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8b7f72]">
        <Sparkles className="h-4 w-4" />
        룸 빌더
      </div>
      <div className="mt-4 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8b7f72]">{activeStep.label}</div>
      <h1 className="mt-2 text-4xl font-light text-[#1b1510]">{activeStep.title}</h1>
      <p className="mt-3 text-sm leading-7 text-[#5c5044]">{activeStep.description}</p>

      <div className="mt-6 grid grid-cols-4 gap-2">
        {steps.map((step, index) => (
          <button
            key={step.label}
            type="button"
            onClick={() => onStepChange(index)}
            className={`rounded-full border px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.2em] transition ${
              stepIndex === index
                ? "border-[#1b1510] bg-[#1b1510] text-white"
                : index < stepIndex
                  ? "border-[#1b1510]/20 bg-[#efe8de] text-[#3c3228]"
                  : "border-black/10 bg-white text-[#7d6f61]"
            }`}
          >
            {index + 1}
          </button>
        ))}
      </div>
    </>
  );
}
