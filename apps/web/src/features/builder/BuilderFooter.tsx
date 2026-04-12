import { ArrowRight } from "lucide-react";

type BuilderFooterProps = {
  stepIndex: number;
  isFinalStep: boolean;
  isCreating: boolean;
  onBack: () => void;
  onNext: () => void;
};

export function BuilderFooter({
  stepIndex,
  isFinalStep,
  isCreating,
  onBack,
  onNext
}: BuilderFooterProps) {
  return (
    <div className="mt-8 flex items-center gap-3 border-t border-black/10 pt-6">
      <button
        type="button"
        onClick={onBack}
        disabled={stepIndex === 0}
        className="inline-flex flex-1 items-center justify-center rounded-full border border-black/15 bg-white px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#2e251d] transition disabled:opacity-35"
      >
        돌아가기
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={isCreating}
        className="inline-flex flex-[1.4] items-center justify-center gap-2 rounded-full bg-[#11100e] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isFinalStep ? (isCreating ? "공간 생성 중..." : "이 공간 디자인하기") : "다음"}
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}
