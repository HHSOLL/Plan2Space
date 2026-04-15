export type HotspotTone = "sand" | "olive" | "slate" | "ember";

export type ProductInspectorModel = {
  id: string;
  name: string;
  thumbnail: string | null;
  price: string | null;
  options: string | null;
  externalUrl: string | null;
  dimensionsMm: {
    width: number;
    depth: number;
    height: number;
  } | null;
  finishColor: string | null;
  finishMaterial: string | null;
  detailNotes: string | null;
  scaleLocked: boolean;
};

export type ProductHotspot = ProductInspectorModel & {
  index: number;
  category: string;
  collection: string;
  tone: HotspotTone;
  anchorType: string;
  brand: string | null;
  material: string | null;
};
