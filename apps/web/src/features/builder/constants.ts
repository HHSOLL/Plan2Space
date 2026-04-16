import type { BuilderStepId, BuilderStepMeta, DoorStyle, WindowStyle } from "./types";

export const BUILDER_STEPS: BuilderStepMeta[] = [
  {
    id: "shape",
    label: "1/4단계",
    title: "모양 및 크기 설정하기",
    description: ""
  },
  {
    id: "dimension",
    label: "2/4단계",
    title: "치수 조정하기",
    description: "방의 벽 크기에 맞게 오른쪽의 평면도를 편집하세요."
  },
  {
    id: "opening",
    label: "3/4단계",
    title: "문과 창문 추가하기",
    description: ""
  },
  {
    id: "style",
    label: "4/4단계",
    title: "방 스타일 선택하기",
    description: ""
  }
];

const BUILDER_STEP_INDEX_BY_ID: Record<BuilderStepId, number> = BUILDER_STEPS.reduce(
  (accumulator, step, index) => ({
    ...accumulator,
    [step.id]: index
  }),
  {
    shape: 0,
    dimension: 1,
    opening: 2,
    style: 3
  } satisfies Record<BuilderStepId, number>
);

export function resolveBuilderStepIndex(stepParam: string | null | undefined) {
  if (!stepParam) return 0;
  if (!(stepParam in BUILDER_STEP_INDEX_BY_ID)) return 0;
  return BUILDER_STEP_INDEX_BY_ID[stepParam as BuilderStepId];
}

export const DOOR_STYLE_LABEL: Record<DoorStyle, string> = {
  single: "싱글 패널 도어",
  double: "이중 패널 도어",
  french: "프렌치 양문형 도어"
};

export const WINDOW_STYLE_LABEL: Record<WindowStyle, string> = {
  single: "유리창 싱글",
  wide: "유리창 더블"
};

export const WALL_FINISH_SWATCH: Record<number, string> = {
  0: "#f2efe9",
  1: "#d6cdbd",
  2: "#9ea5a8"
};

export const FLOOR_FINISH_SWATCH: Record<number, string> = {
  0: "linear-gradient(135deg, #c9ab7f 0%, #b98e61 100%)",
  1: "linear-gradient(135deg, #807a75 0%, #5f5954 100%)",
  2: "linear-gradient(135deg, #d2cdc4 0%, #b9b2a6 100%)"
};
