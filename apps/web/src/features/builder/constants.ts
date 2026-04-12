import type { BuilderStepId, BuilderStepMeta, DoorStyle, WindowStyle } from "./types";

export const BUILDER_STEPS: BuilderStepMeta[] = [
  {
    id: "shape",
    label: "1/4단계",
    title: "모양 및 크기 설정하기",
    description: "방 형태를 먼저 선택하고 다음 단계에서 치수를 조정합니다."
  },
  {
    id: "dimension",
    label: "2/4단계",
    title: "치수 조정하기",
    description: "선택한 방의 가로/세로와 세부 치수를 실제 공간에 맞게 조정합니다."
  },
  {
    id: "opening",
    label: "3/4단계",
    title: "문과 창문 추가하기",
    description: "벽 기준으로 문/창문을 배치하고 위치와 폭을 조정합니다."
  },
  {
    id: "style",
    label: "4/4단계",
    title: "방 스타일 선택하기",
    description: "벽/바닥 스타일을 선택하고 프로젝트 정보를 확인합니다."
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
  wide: "유리창 와이드"
};

export const WALL_FINISH_SWATCH: Record<number, string> = {
  0: "#efe9df",
  1: "#f9f7f2",
  2: "#6e6964"
};

export const FLOOR_FINISH_SWATCH: Record<number, string> = {
  0: "#b58f67",
  1: "#7a7570",
  2: "#d8d3cb"
};
