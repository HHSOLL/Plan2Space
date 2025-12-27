export type UUID = string;

export type MaterialSku = {
  id: UUID;
  name: string;
  category: "floor" | "wall" | "ceiling";
  brand?: string;
  priceBand?: "budget" | "standard" | "premium";
  thumbnailUrl: string;
};

export type DesignDoc = {
  id: UUID;
  projectId: UUID;
  revision: number;
  plan2d: {
    unit: "m";
    params: { wallHeight: number; wallThickness: number; ceilingHeight: number };
    walls: Array<{ id: string; a: { x: number; y: number }; b: { x: number; y: number }; locked?: boolean }>;
    rooms: Array<{ id: string; name: string; polygon: Array<{ x: number; y: number }> }>;
    openings: Array<{ id: string; wallId: string; type: "door" | "window"; offset: number; width: number; height: number; verticalOffset?: number; swing?: "left" | "right" }>;
  };
  surfaceMaterials: Record<string, UUID>;
  objects: Array<{ id: string; objectSkuId: UUID; name: string; pos: { x: number; y: number; z: number }; rotY: number }>;
};

export type QuantityTakeoff = {
  projectId: string;
  designDocId: string;
  revision: number;
  rooms: Array<{ id: string; name: string; areaSqm: number }>;
  totals: {
    floorAreaSqm: number;
    wallLengthM: number;
    wallAreaSqm: number;
    openingCount: number;
    openingAreaSqm: number;
  };
};
