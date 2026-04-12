export type HotspotTone = "sand" | "olive" | "slate" | "ember";

export type ProductInspectorModel = {
  id: string;
  name: string;
  thumbnail: string | null;
  price: string | null;
  options: string | null;
  externalUrl: string | null;
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
