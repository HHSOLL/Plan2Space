import type { Floor, Opening, ScaleInfo, Wall } from "../stores/useSceneStore";

export type BuilderTemplateId =
  | "rect-studio"
  | "l-shape"
  | "cut-shape"
  | "t-shape"
  | "u-shape"
  | "slanted-shape";

export type BuilderTemplate = {
  id: BuilderTemplateId;
  name: string;
  eyebrow: string;
  description: string;
  accent: string;
  defaultWidth: number;
  defaultDepth: number;
  defaultNookWidth?: number;
  defaultNookDepth?: number;
};

export const builderTemplates: BuilderTemplate[] = [
  {
    id: "rect-studio",
    name: "사각형",
    eyebrow: "기본 형태",
    description: "가장 빠르게 시작할 수 있는 직사각형 방 형태입니다.",
    accent: "#c96f3b",
    defaultWidth: 6.4,
    defaultDepth: 4.8
  },
  {
    id: "l-shape",
    name: "L자형",
    eyebrow: "코너 확장",
    description: "한쪽이 확장된 L형 구조로 구역 분리가 쉬운 형태입니다.",
    accent: "#2f6c61",
    defaultWidth: 7.6,
    defaultDepth: 6.2,
    defaultNookWidth: 2.8,
    defaultNookDepth: 2.4
  },
  {
    id: "cut-shape",
    name: "잘라내기",
    eyebrow: "모서리 컷",
    description: "모서리를 사선으로 잘라낸 형태로 진입 동선을 확보하기 좋습니다.",
    accent: "#7c5c42",
    defaultWidth: 6.8,
    defaultDepth: 5.2,
    defaultNookWidth: 2.0,
    defaultNookDepth: 1.6
  },
  {
    id: "t-shape",
    name: "T자형",
    eyebrow: "복합 구역",
    description: "중앙 복도와 상단 확장부를 가진 형태로 작업/수납 구역 분리에 적합합니다.",
    accent: "#5f6d86",
    defaultWidth: 7.8,
    defaultDepth: 6.0,
    defaultNookWidth: 3.0,
    defaultNookDepth: 2.2
  },
  {
    id: "u-shape",
    name: "U자형",
    eyebrow: "집중형 배치",
    description: "내부 포켓 공간이 있어 데스크테리어 집중 배치에 유리합니다.",
    accent: "#5f6752",
    defaultWidth: 8.0,
    defaultDepth: 5.8,
    defaultNookWidth: 2.4,
    defaultNookDepth: 1.4
  },
  {
    id: "slanted-shape",
    name: "경사진 형태",
    eyebrow: "사선 외곽",
    description: "경사진 벽 라인이 포함된 형태로 전시형 장면 구성에 적합합니다.",
    accent: "#6a5a7b",
    defaultWidth: 7.2,
    defaultDepth: 5.4,
    defaultNookWidth: 1.4,
    defaultNookDepth: 1.4
  }
];

export const builderWallFinishes = [
  { id: 0, name: "Soft Plaster" },
  { id: 1, name: "Gallery White" },
  { id: 2, name: "Dark Concrete" }
] as const;

export const builderFloorFinishes = [
  { id: 0, name: "Oak Boards" },
  { id: 1, name: "Worn Concrete" },
  { id: 2, name: "Stone Marble" }
] as const;

export type BuilderSceneInput = {
  templateId: BuilderTemplateId;
  width: number;
  depth: number;
  nookWidth?: number;
  nookDepth?: number;
};

export type BuilderScene = {
  scale: number;
  scaleInfo: ScaleInfo;
  walls: Wall[];
  openings: Opening[];
  floors: Floor[];
};

const DEFAULT_WALL_THICKNESS = 0.16;
const DEFAULT_WALL_HEIGHT = 2.8;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function polygonToWalls(points: Array<[number, number]>): Wall[] {
  return points.map((point, index) => {
    const next = points[(index + 1) % points.length]!;
    return {
      id: `wall-${index + 1}`,
      start: point,
      end: next,
      thickness: DEFAULT_WALL_THICKNESS,
      height: DEFAULT_WALL_HEIGHT,
      type: "exterior"
    } satisfies Wall;
  });
}

function getWallLength(wall: Wall) {
  return Math.hypot(wall.end[0] - wall.start[0], wall.end[1] - wall.start[1]);
}

function buildPolygon(input: BuilderSceneInput) {
  const width = input.width;
  const depth = input.depth;
  const nookWidth = clamp(input.nookWidth ?? width * 0.34, 1.2, Math.max(1.2, width - 1.6));
  const nookDepth = clamp(input.nookDepth ?? depth * 0.32, 1.0, Math.max(1.0, depth - 1.4));

  switch (input.templateId) {
    case "l-shape":
      return [
        [0, 0],
        [width, 0],
        [width, depth - nookDepth],
        [width - nookWidth, depth - nookDepth],
        [width - nookWidth, depth],
        [0, depth]
      ] as Array<[number, number]>;
    case "cut-shape":
      return [
        [0, 0],
        [width, 0],
        [width, depth - nookDepth],
        [width - nookWidth, depth],
        [0, depth]
      ] as Array<[number, number]>;
    case "t-shape": {
      const stemWidth = clamp(input.nookWidth ?? width * 0.4, 1.8, Math.max(1.8, width - 1.2));
      const stemDepth = clamp(input.nookDepth ?? depth * 0.38, 1.4, Math.max(1.4, depth - 1.1));
      const halfStem = stemWidth / 2;
      const center = width / 2;
      return [
        [0, 0],
        [width, 0],
        [width, stemDepth],
        [center + halfStem, stemDepth],
        [center + halfStem, depth],
        [center - halfStem, depth],
        [center - halfStem, stemDepth],
        [0, stemDepth]
      ] as Array<[number, number]>;
    }
    case "u-shape": {
      const notchWidth = clamp(input.nookWidth ?? width * 0.3, 1.4, Math.max(1.4, width - 1.8));
      const notchDepth = clamp(input.nookDepth ?? depth * 0.28, 0.9, Math.max(0.9, depth - 1.5));
      const halfNotch = notchWidth / 2;
      const center = width / 2;
      return [
        [0, 0],
        [width, 0],
        [width, depth],
        [center + halfNotch, depth],
        [center + halfNotch, depth - notchDepth],
        [center - halfNotch, depth - notchDepth],
        [center - halfNotch, depth],
        [0, depth]
      ] as Array<[number, number]>;
    }
    case "slanted-shape": {
      const bevel = clamp(input.nookDepth ?? Math.min(width, depth) * 0.18, 0.6, Math.min(width, depth) * 0.35);
      return [
        [0, 0],
        [width, 0],
        [width, depth - bevel],
        [width - bevel, depth],
        [bevel, depth],
        [0, depth - bevel]
      ] as Array<[number, number]>;
    }
    case "rect-studio":
    default:
      return [
        [0, 0],
        [width, 0],
        [width, depth],
        [0, depth]
      ] as Array<[number, number]>;
  }
}

function buildOpenings(walls: Wall[], templateId: BuilderTemplateId): Opening[] {
  const entranceWall = walls[0];
  const windowWall = walls[Math.min(2, walls.length - 1)] ?? walls[walls.length - 1];

  const entranceLength = entranceWall ? getWallLength(entranceWall) : 0;
  const windowLength = windowWall ? getWallLength(windowWall) : 0;

  const doorWidth = 0.92;
  const windowWidth = templateId === "u-shape" || templateId === "t-shape" ? 2.2 : 1.8;

  const openings: Opening[] = [];

  if (entranceWall) {
    openings.push({
      id: "opening-entry",
      wallId: entranceWall.id,
      type: "door",
      offset: clamp(entranceLength * 0.18, 0.48, Math.max(0.48, entranceLength - doorWidth - 0.48)),
      width: doorWidth,
      height: 2.1,
      isEntrance: true
    });
  }

  if (windowWall) {
    openings.push({
      id: "opening-window-main",
      wallId: windowWall.id,
      type: "window",
      offset: clamp(windowLength * 0.22, 0.5, Math.max(0.5, windowLength - windowWidth - 0.5)),
      width: Math.min(windowWidth, Math.max(1.2, windowLength - 1)),
      height: 1.3,
      sillHeight: 0.9
    });
  }

  return openings;
}

export function buildBuilderScene(input: BuilderSceneInput): BuilderScene {
  const polygon = buildPolygon(input);
  const walls = polygonToWalls(polygon);
  const openings = buildOpenings(walls, input.templateId);

  return {
    scale: 1,
    scaleInfo: {
      value: 1,
      source: "user_measure",
      confidence: 0.94,
      evidence: {
        notes: "Builder-authored dimensions are stored directly in meters."
      }
    },
    walls,
    openings,
    floors: [
      {
        id: "floor-main",
        outline: polygon,
        materialId: null,
        label: "Main Floor"
      }
    ]
  };
}
