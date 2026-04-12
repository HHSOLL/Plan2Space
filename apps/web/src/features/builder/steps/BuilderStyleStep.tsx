import type { BuilderFinishOption } from "../../../lib/api/room-templates";

type BuilderStyleStepProps = {
  projectName: string;
  projectDescription: string;
  wallMaterialIndex: number;
  floorMaterialIndex: number;
  wallFinishOptions: BuilderFinishOption[];
  floorFinishOptions: BuilderFinishOption[];
  wallFinishSwatch: Record<number, string>;
  floorFinishSwatch: Record<number, string>;
  onProjectNameChange: (value: string) => void;
  onProjectDescriptionChange: (value: string) => void;
  onWallMaterialIndexChange: (index: number) => void;
  onFloorMaterialIndexChange: (index: number) => void;
};

export function BuilderStyleStep({
  projectName,
  projectDescription,
  wallMaterialIndex,
  floorMaterialIndex,
  wallFinishOptions,
  floorFinishOptions,
  wallFinishSwatch,
  floorFinishSwatch,
  onProjectNameChange,
  onProjectDescriptionChange,
  onWallMaterialIndexChange,
  onFloorMaterialIndexChange
}: BuilderStyleStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8b7f72]">프로젝트 이름</label>
        <input
          type="text"
          value={projectName}
          onChange={(event) => onProjectNameChange(event.target.value)}
          className="mt-3 w-full rounded-[18px] border border-black/10 bg-[#fcfaf6] px-4 py-4 text-sm outline-none transition focus:border-black/40"
        />
      </div>

      <div>
        <label className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8b7f72]">설명</label>
        <textarea
          value={projectDescription}
          onChange={(event) => onProjectDescriptionChange(event.target.value)}
          rows={4}
          className="mt-3 w-full rounded-[18px] border border-black/10 bg-[#fcfaf6] px-4 py-4 text-sm outline-none transition focus:border-black/40"
        />
      </div>

      <div className="space-y-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8b7f72]">벽 스타일</div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {wallFinishOptions.map((finish) => (
            <button
              key={finish.id}
              type="button"
              onClick={() => onWallMaterialIndexChange(finish.id)}
              className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                wallMaterialIndex === finish.id
                  ? "border-black/30 bg-[#f2ebe2]"
                  : "border-black/10 bg-[#fcfaf6] hover:border-black/25"
              }`}
            >
              <span
                className="h-7 w-7 rounded-md border border-black/10"
                style={{ background: wallFinishSwatch[finish.id] ?? "#ece6dc" }}
              />
              <span className="text-sm font-semibold text-[#3a3026]">{finish.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8b7f72]">바닥 스타일</div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {floorFinishOptions.map((finish) => (
            <button
              key={finish.id}
              type="button"
              onClick={() => onFloorMaterialIndexChange(finish.id)}
              className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                floorMaterialIndex === finish.id
                  ? "border-black/30 bg-[#f2ebe2]"
                  : "border-black/10 bg-[#fcfaf6] hover:border-black/25"
              }`}
            >
              <span
                className="h-7 w-7 rounded-md border border-black/10"
                style={{ background: floorFinishSwatch[finish.id] ?? "#b79d7e" }}
              />
              <span className="text-sm font-semibold text-[#3a3026]">{finish.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
