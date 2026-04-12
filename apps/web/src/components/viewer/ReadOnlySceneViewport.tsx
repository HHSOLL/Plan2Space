import { SceneViewport } from "../editor/SceneViewport";

type ReadOnlySceneViewportProps = {
  viewMode: "top" | "walk";
  selectedLabel: string | null;
  showReadOnlyNotice: boolean;
};

export function ReadOnlySceneViewport({
  viewMode,
  selectedLabel,
  showReadOnlyNotice
}: ReadOnlySceneViewportProps) {
  return (
    <div className="space-y-4 xl:order-2">
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8a7c70]">뷰어 캔버스</div>
          <p className="mt-1 text-sm leading-6 text-[#665c51]">
            읽기 전용 3D 장면에서 제품을 선택하고 상세 정보를 확인할 수 있습니다.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-[30px] border border-black/10 bg-white shadow-[0_20px_54px_rgba(16,18,22,0.16)]">
        <div className="flex items-center justify-between gap-3 border-b border-black/8 bg-[#fcfaf6] px-4 py-3 sm:px-5">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#7a7064]">
            {viewMode === "top" ? "상단뷰" : "워크뷰"}
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8e8377]">
            {selectedLabel ? `${selectedLabel} 선택됨` : "선택된 제품 없음"}
          </div>
        </div>

        <SceneViewport
          className="h-[72vh] rounded-none border-0 shadow-none sm:h-[78vh]"
          camera={{ fov: 45, position: [0, 8, 14] }}
          toneMappingExposure={1.05}
          chromeTone="light"
          interactionMode="viewer"
          modeBadge={viewMode === "top" ? "읽기 전용 상단뷰" : "읽기 전용 워크뷰"}
          bottomNotice={showReadOnlyNotice ? "이 링크는 읽기 전용 모드로 열립니다." : null}
        />
      </div>
    </div>
  );
}
