import type { Floor, Opening, ScaleInfo, Wall } from "../stores/useSceneStore";

export type BuilderTemplateId = "rect-studio" | "corner-suite" | "gallery-loft";

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
    name: "Rect Studio",
    eyebrow: "Fastest launch",
    description: "A clean rectangular room tuned for desks, lounge furniture, and camera-friendly compositions.",
    accent: "#c96f3b",
    defaultWidth: 6.4,
    defaultDepth: 4.8
  },
  {
    id: "corner-suite",
    name: "Corner Suite",
    eyebrow: "Best for zoning",
    description: "An L-shaped shell with a recessed corner for dining, media, or bedroom zoning.",
    accent: "#2f6c61",
    defaultWidth: 7.6,
    defaultDepth: 6.2,
    defaultNookWidth: 2.8,
    defaultNookDepth: 2.4
  },
  {
    id: "gallery-loft",
    name: "Gallery Loft",
    eyebrow: "Open display",
    description: "A wider footprint with generous wall runs for shelving, art, and product-led storytelling.",
    accent: "#46566b",
    defaultWidth: 8.4,
    defaultDepth: 5.6
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
  if (input.templateId !== "corner-suite") {
    return [
      [0, 0],
      [input.width, 0],
      [input.width, input.depth],
      [0, input.depth]
    ] as Array<[number, number]>;
  }

  const nookWidth = clamp(input.nookWidth ?? input.width * 0.36, 1.6, Math.max(1.6, input.width - 1.8));
  const nookDepth = clamp(input.nookDepth ?? input.depth * 0.38, 1.4, Math.max(1.4, input.depth - 1.8));

  return [
    [0, 0],
    [input.width, 0],
    [input.width, input.depth - nookDepth],
    [input.width - nookWidth, input.depth - nookDepth],
    [input.width - nookWidth, input.depth],
    [0, input.depth]
  ] as Array<[number, number]>;
}

function buildOpenings(walls: Wall[], templateId: BuilderTemplateId): Opening[] {
  const entranceWall = walls[0];
  const windowWall = walls[Math.min(2, walls.length - 1)] ?? walls[walls.length - 1];

  const entranceLength = entranceWall ? getWallLength(entranceWall) : 0;
  const windowLength = windowWall ? getWallLength(windowWall) : 0;

  const doorWidth = 0.92;
  const windowWidth = templateId === "gallery-loft" ? 2.4 : 1.8;

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
