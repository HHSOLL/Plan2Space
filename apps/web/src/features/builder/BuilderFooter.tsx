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
  const primaryLabel = isFinalStep ? (isCreating ? "공간 생성 중..." : "이 공간 디자인하기") : "다음";

  return (
    <div className="border-t border-black/10 bg-white px-6 py-5 xl:px-9">
      {stepIndex === 0 ? (
        <button
          type="button"
          onClick={onNext}
          disabled={isCreating}
          className="inline-flex h-14 w-full items-center justify-center rounded-full bg-[#111111] px-6 text-base font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
        >
          {primaryLabel}
        </button>
      ) : (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-14 flex-1 items-center justify-center rounded-full border border-black/20 bg-white px-6 text-base font-semibold text-[#1c1814] transition hover:border-black/40"
          >
            돌아가기
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={isCreating}
            className="inline-flex h-14 flex-[1.25] items-center justify-center rounded-full bg-[#111111] px-6 text-base font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {primaryLabel}
          </button>
        </div>
      )}
    </div>
  );
}
