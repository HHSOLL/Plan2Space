import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type ProductDimensionsMm = {
  width: number;
  depth: number;
  height: number;
};

type CatalogEntry = {
  id: string;
  label: string;
  category: string;
  assetId: string;
  scale: [number, number, number];
  description: string;
  thumbnail?: string | null;
  price?: string | null;
  options?: string | null;
  externalUrl?: string | null;
  brand?: string | null;
  dimensionsMm?: ProductDimensionsMm | null;
  finishColor?: string | null;
  finishMaterial?: string | null;
  detailNotes?: string | null;
  scaleLocked?: boolean;
  supportProfile?: {
    surfaces: Array<{
      id: string;
      anchorTypes: Array<"desk_surface" | "shelf_surface" | "furniture_surface">;
      center: [number, number];
      size: [number, number];
      top: number;
      margin?: [number, number];
    }>;
  } | null;
};

const MANIFEST_CANDIDATES = [
  path.join(process.cwd(), "public", "assets", "catalog", "manifest.json"),
  path.join(process.cwd(), "apps", "web", "public", "assets", "catalog", "manifest.json")
] as const;

const CURATED_INSERTS: CatalogEntry[] = [
  {
    id: "p2s_desk_oak_140",
    label: "P2S 오크 데스크 1400",
    category: "Tables",
    assetId: "/assets/models/p2s_desk_oak/p2s_desk_oak.glb",
    scale: [1, 1, 1],
    description: "Plan2Space에서 Blender로 직접 제작한 기본 데스크 자산입니다.",
    brand: "Plan2Space Studio",
    price: "₩189,000",
    options: "1330x581x575 mm (Blender measured envelope)",
    externalUrl: "https://www.ikea.com/kr/ko/search/?q=%EC%B1%85%EC%83%81",
    dimensionsMm: {
      width: 1330,
      depth: 581,
      height: 575
    },
    finishColor: "Natural oak",
    finishMaterial: "Oak veneer over engineered wood",
    detailNotes:
      "Rectangular desk with a straight apron and slab top. Dimensions reflect Blender-measured envelope for runtime fidelity.",
    scaleLocked: true,
    supportProfile: {
      surfaces: [
        {
          id: "desk-top",
          anchorTypes: ["desk_surface", "furniture_surface"],
          center: [0, 0],
          size: [1.33, 0.58],
          top: 0.755,
          margin: [0.08, 0.08]
        }
      ]
    }
  },
  {
    id: "p2s_monitor_stand_wood",
    label: "P2S 우드 모니터 스탠드",
    category: "Storage",
    assetId: "/assets/models/p2s_monitor_stand/p2s_monitor_stand.glb",
    scale: [1, 1, 1],
    description: "키보드 수납 공간이 있는 데스크 전용 모니터 스탠드입니다.",
    brand: "Plan2Space Studio",
    price: "₩39,000",
    options: "560x130x71 mm (Blender measured envelope)",
    externalUrl: "https://www.ikea.com/kr/ko/search/?q=%EB%AA%A8%EB%8B%88%ED%84%B0%20%EC%8A%A4%ED%83%A0%EB%93%9C",
    dimensionsMm: {
      width: 560,
      depth: 130,
      height: 71
    },
    finishColor: "Warm walnut",
    finishMaterial: "Walnut veneer over plywood",
    detailNotes:
      "Low-profile riser for one ultrawide or dual compact monitors. Dimensions reflect Blender-measured envelope.",
    scaleLocked: true,
    supportProfile: {
      surfaces: [
        {
          id: "stand-top",
          anchorTypes: ["desk_surface", "furniture_surface"],
          center: [0, 0],
          size: [0.56, 0.13],
          top: 0.072,
          margin: [0.02, 0.02]
        }
      ]
    }
  },
  {
    id: "p2s_desk_lamp_glow",
    label: "P2S 글로우 데스크 램프",
    category: "Lighting",
    assetId: "/assets/models/p2s_desk_lamp_glow/p2s_desk_lamp_glow.glb",
    scale: [1, 1, 1],
    description: "발광 벌브가 포함된 데스크 램프입니다. 뷰어/에디터에서 조명 효과가 적용됩니다.",
    brand: "Plan2Space Studio",
    price: "₩59,000",
    options: "3000K 웜 라이트 · light-emitter",
    externalUrl: "https://www.ikea.com/kr/ko/search/?q=%EB%8D%B0%EC%8A%A4%ED%81%AC%20%EB%9E%A8%ED%94%84",
    dimensionsMm: {
      width: 445,
      depth: 227,
      height: 483
    },
    finishColor: "Matte ivory",
    finishMaterial: "Powder-coated steel with frosted acrylic diffuser",
    detailNotes:
      "Adjustable desk lamp with integrated warm emitter. Dimensions reflect Blender-measured envelope for accurate placement.",
    scaleLocked: true
  }
];

const CURATED_UPDATES: Record<string, Partial<CatalogEntry>> = {
  SchoolDesk_01: {
    category: "Tables",
    brand: "Poly Haven (CC0)",
    options: "오픈소스 3D 자산 · school desk",
    externalUrl: "https://polyhaven.com/"
  },
  SchoolChair_01: {
    category: "Seating",
    brand: "Poly Haven (CC0)",
    options: "오픈소스 3D 자산 · school chair",
    externalUrl: "https://polyhaven.com/"
  },
  desk_lamp_arm_01: {
    category: "Lighting",
    brand: "Poly Haven (CC0)",
    options: "오픈소스 3D 자산 · articulated lamp · light-emitter",
    externalUrl: "https://polyhaven.com/"
  }
};

function normalizeScale(value: unknown): [number, number, number] {
  if (Array.isArray(value) && value.length === 3 && value.every((entry) => typeof entry === "number")) {
    return value as [number, number, number];
  }
  return [1, 1, 1];
}

function mergeEntry(base: CatalogEntry, patch: Partial<CatalogEntry>): CatalogEntry {
  const merged = {
    ...base,
    ...patch,
    scale: normalizeScale(patch.scale ?? base.scale)
  };
  return merged;
}

async function resolveManifestPath() {
  for (const candidate of MANIFEST_CANDIDATES) {
    try {
      await readFile(candidate, "utf8");
      return candidate;
    } catch {
      continue;
    }
  }
  throw new Error("catalog manifest.json 파일을 찾을 수 없습니다.");
}

async function run() {
  const manifestPath = await resolveManifestPath();
  const raw = await readFile(manifestPath, "utf8");
  const parsed = JSON.parse(raw) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("catalog manifest 포맷이 배열이 아닙니다.");
  }

  const items = parsed as CatalogEntry[];
  const byId = new Map<string, CatalogEntry>();
  items.forEach((item) => {
    byId.set(item.id, {
      ...item,
      scale: normalizeScale(item.scale)
    });
  });

  Object.entries(CURATED_UPDATES).forEach(([id, patch]) => {
    const current = byId.get(id);
    if (!current) return;
    byId.set(id, mergeEntry(current, patch));
  });

  CURATED_INSERTS.forEach((entry) => {
    const current = byId.get(entry.id);
    byId.set(entry.id, current ? mergeEntry(current, entry) : entry);
  });

  const merged = Array.from(byId.values());
  await writeFile(manifestPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");

  console.log(`manifest updated: ${manifestPath}`);
  console.log(`total items: ${merged.length}`);
  console.log(
    "deskterior ids:",
    merged
      .filter((item) => item.id.startsWith("p2s_") || item.id === "SchoolDesk_01" || item.id === "SchoolChair_01" || item.id === "desk_lamp_arm_01")
      .map((item) => item.id)
      .join(", ")
  );
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
