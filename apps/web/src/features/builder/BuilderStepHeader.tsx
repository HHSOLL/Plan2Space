import type { BuilderStepMeta } from "./types";

type BuilderStepHeaderProps = {
  activeStep: BuilderStepMeta;
};

export function BuilderStepHeader({ activeStep }: BuilderStepHeaderProps) {
  return (
    <div>
      <div className="text-sm font-semibold text-[#5f564d]">{activeStep.label}</div>
      <h1 className="mt-1 text-[2rem] font-black leading-[1.15] tracking-[-0.03em] text-[#171411] sm:text-[2.3rem]">
        {activeStep.title}
      </h1>
      {activeStep.description ? (
        <p className="mt-5 max-w-[320px] text-sm leading-6 text-[#72685d]">{activeStep.description}</p>
      ) : null}
    </div>
  );
}
