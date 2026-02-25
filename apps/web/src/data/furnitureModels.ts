/**
 * 3D 모델 라이브러리 메타데이터
 * Supabase Storage 또는 로컬 public/models 폴더의 GLB 파일 참조
 */

export type FurnitureModelCategory = "sofa" | "chair" | "table" | "lamp" | "decoration";

export interface FurnitureModel {
  id: string;
  name: string;
  category: FurnitureModelCategory;
  description: string;
  modelPath: string;
  thumbnailUrl: string;
  defaultScale: { x: number; y: number; z: number };
  defaultRotation: { x: number; y: number; z: number };
  boundingBox?: {
    width: number;
    height: number;
    depth: number;
  };
}

export const FURNITURE_MODELS: FurnitureModel[] = [
  {
    id: "model_sofa_01",
    name: "Modern Sofa",
    category: "sofa",
    description: "Contemporary L-shaped sofa with gray fabric",
    modelPath: "/models/sofa/modern-sofa.glb",
    thumbnailUrl: "/images/model-placeholder.svg",
    defaultScale: { x: 1, y: 1, z: 1 },
    defaultRotation: { x: 0, y: 0, z: 0 },
    boundingBox: { width: 2.5, height: 0.8, depth: 1.2 }
  },
  {
    id: "model_chair_01",
    name: "Office Chair",
    category: "chair",
    description: "Ergonomic office chair with adjustable height",
    modelPath: "/models/chair/office-chair.glb",
    thumbnailUrl: "/images/model-placeholder.svg",
    defaultScale: { x: 1, y: 1, z: 1 },
    defaultRotation: { x: 0, y: 0, z: 0 },
    boundingBox: { width: 0.7, height: 1.0, depth: 0.7 }
  },
  {
    id: "model_table_01",
    name: "Dining Table",
    category: "table",
    description: "Wooden dining table for 6 people",
    modelPath: "/models/table/dining-table.glb",
    thumbnailUrl: "/images/model-placeholder.svg",
    defaultScale: { x: 1, y: 1, z: 1 },
    defaultRotation: { x: 0, y: 0, z: 0 },
    boundingBox: { width: 1.8, height: 0.75, depth: 0.9 }
  }
];

export const getModelsByCategory = (category: FurnitureModelCategory) => {
  return FURNITURE_MODELS.filter((model) => model.category === category);
};

export const ALL_CATEGORIES: FurnitureModelCategory[] = ["sofa", "chair", "table", "lamp", "decoration"];
