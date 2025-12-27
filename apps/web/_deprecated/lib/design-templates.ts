import type { DesignDoc } from "@webinterior/shared/types";

export const PRUJIO_PLAN_IMAGE_URL = "/plans/prujio.jpeg";

export const STARTER_ROOM_TEMPLATE: DesignDoc = {
  id: "template_room_v1",
  projectId: "template_room",
  revision: 1,
  plan2d: {
    unit: "m",
    params: { wallHeight: 2.4, wallThickness: 0.1, ceilingHeight: 2.4 },
    walls: [
      { id: "w1", a: { x: 0, y: 0 }, b: { x: 6, y: 0 }, locked: false },
      { id: "w2", a: { x: 6, y: 0 }, b: { x: 6, y: 4 }, locked: false },
      { id: "w3", a: { x: 6, y: 4 }, b: { x: 0, y: 4 }, locked: false },
      { id: "w4", a: { x: 0, y: 4 }, b: { x: 0, y: 0 }, locked: false }
    ],
    rooms: [
      {
        id: "r1",
        name: "거실",
        polygon: [
          { x: 0, y: 0 },
          { x: 6, y: 0 },
          { x: 6, y: 4 },
          { x: 0, y: 4 }
        ]
      }
    ],
    openings: []
  },
  surfaceMaterials: {
    "floor:r1": "m_floor_01",
    "ceiling:r1": "m_ceiling_01",
    "wall:w1:face:in": "m_wall_01",
    "wall:w2:face:in": "m_wall_02",
    "wall:w3:face:in": "m_wall_01",
    "wall:w4:face:in": "m_wall_01"
  },
  objects: [
    { id: "obj_sofa", objectSkuId: "o_sofa_01", name: "소파(예시)", pos: { x: 2.1, y: 0, z: 2.7 }, rotY: 1.57 },
    { id: "obj_tv", objectSkuId: "o_tv_01", name: "TV(예시)", pos: { x: 5.6, y: 0, z: 2.0 }, rotY: -1.57 },
    { id: "obj_table", objectSkuId: "o_table_01", name: "테이블(예시)", pos: { x: 3.2, y: 0, z: 2.2 }, rotY: 0 }
  ]
};

export const PRUJIO_TEMPLATE: DesignDoc = {
  id: "template_prujio_v1",
  projectId: "template_prujio",
  revision: 1,
  plan2d: {
    unit: "m",
    params: { wallHeight: 2.5, wallThickness: 0.12, ceilingHeight: 2.5 },
    walls: [
      { id: "w1", a: { x: 0, y: 0 }, b: { x: 12, y: 0 }, locked: true },
      { id: "w2", a: { x: 12, y: 0 }, b: { x: 12, y: 7.4 }, locked: true },
      { id: "w3", a: { x: 12, y: 7.4 }, b: { x: 0, y: 7.4 }, locked: true },
      { id: "w4", a: { x: 0, y: 7.4 }, b: { x: 0, y: 0 }, locked: true },

      // partition block (침실 3개)
      { id: "w5", a: { x: 4.25, y: 0 }, b: { x: 4.25, y: 7.4 }, locked: true },
      { id: "w6", a: { x: 0, y: 2.6 }, b: { x: 4.25, y: 2.6 }, locked: true },
      { id: "w7", a: { x: 0, y: 5.0 }, b: { x: 4.25, y: 5.0 }, locked: true },

      // 리빙/주방/복도 파티션
      { id: "w8", a: { x: 4.25, y: 4.05 }, b: { x: 12, y: 4.05 }, locked: true },
      { id: "w9", a: { x: 9.25, y: 4.05 }, b: { x: 9.25, y: 7.4 }, locked: true },
      { id: "w10", a: { x: 9.25, y: 5.55 }, b: { x: 12, y: 5.55 }, locked: true }
    ],
    rooms: [
      {
        id: "r_bed_1",
        name: "침실(1)",
        polygon: [
          { x: 0, y: 0 },
          { x: 4.2, y: 0 },
          { x: 4.2, y: 2.6 },
          { x: 0, y: 2.6 }
        ]
      },
      {
        id: "r_bed_2",
        name: "침실(2)",
        polygon: [
          { x: 0, y: 2.6 },
          { x: 4.2, y: 2.6 },
          { x: 4.2, y: 5.0 },
          { x: 0, y: 5.0 }
        ]
      },
      {
        id: "r_bed_3",
        name: "침실(3)",
        polygon: [
          { x: 0, y: 5.0 },
          { x: 4.2, y: 5.0 },
          { x: 4.2, y: 7.2 },
          { x: 0, y: 7.2 }
        ]
      },
      {
        id: "r_living",
        name: "거실/주방",
        polygon: [
          { x: 4.2, y: 0 },
          { x: 11.8, y: 0 },
          { x: 11.8, y: 4.0 },
          { x: 4.2, y: 4.0 }
        ]
      },
      {
        id: "r_kitchen",
        name: "주방",
        polygon: [
          { x: 4.2, y: 4.0 },
          { x: 9.2, y: 4.0 },
          { x: 9.2, y: 7.2 },
          { x: 4.2, y: 7.2 }
        ]
      },
      {
        id: "r_entry",
        name: "현관/복도",
        polygon: [
          { x: 9.2, y: 4.0 },
          { x: 11.8, y: 4.0 },
          { x: 11.8, y: 5.5 },
          { x: 9.2, y: 5.5 }
        ]
      },
      {
        id: "r_bath",
        name: "욕실",
        polygon: [
          { x: 9.2, y: 5.5 },
          { x: 11.8, y: 5.5 },
          { x: 11.8, y: 7.2 },
          { x: 9.2, y: 7.2 }
        ]
      }
    ],
    openings: [
      { id: "o_entry", wallId: "w2", type: "door", offset: 1.25, width: 1.1, height: 2.1, swing: "left" },
      { id: "o_living", wallId: "w8", type: "door", offset: 3.7, width: 1.0, height: 2.1, swing: "right" },
      { id: "o_bed_1", wallId: "w5", type: "door", offset: 1.35, width: 0.9, height: 2.1, swing: "left" },
      { id: "o_bed_2", wallId: "w5", type: "door", offset: 3.8, width: 0.9, height: 2.1, swing: "right" },
      { id: "o_bed_3", wallId: "w5", type: "door", offset: 6.2, width: 0.9, height: 2.1, swing: "left" },
      { id: "o_bath", wallId: "w10", type: "door", offset: 0.9, width: 0.8, height: 2.1, swing: "left" }
    ]
  },
  surfaceMaterials: {
    "floor:r_bed_1": "m_floor_01",
    "floor:r_bed_2": "m_floor_01",
    "floor:r_bed_3": "m_floor_01",
    "floor:r_living": "m_floor_03",
    "floor:r_kitchen": "m_floor_02",
    "floor:r_entry": "m_floor_02",
    "floor:r_bath": "m_floor_02",

    "ceiling:r_bed_1": "m_ceiling_01",
    "ceiling:r_bed_2": "m_ceiling_01",
    "ceiling:r_bed_3": "m_ceiling_01",
    "ceiling:r_living": "m_ceiling_01",
    "ceiling:r_kitchen": "m_ceiling_01",
    "ceiling:r_entry": "m_ceiling_01",
    "ceiling:r_bath": "m_ceiling_01",

    "wall:w1:face:in": "m_wall_01",
    "wall:w2:face:in": "m_wall_03",
    "wall:w3:face:in": "m_wall_01",
    "wall:w4:face:in": "m_wall_01",
    "wall:w5:face:in": "m_wall_02",
    "wall:w6:face:in": "m_wall_01",
    "wall:w7:face:in": "m_wall_01",
    "wall:w8:face:in": "m_wall_01",
    "wall:w9:face:in": "m_wall_01",
    "wall:w10:face:in": "m_wall_01"
  },
  objects: [
    { id: "obj_lv_sofa", objectSkuId: "o_sofa_01", name: "소파(예시)", pos: { x: 8.5, y: 0, z: 1.2 }, rotY: 3.14 },
    { id: "obj_lv_tv", objectSkuId: "o_tv_01", name: "TV(예시)", pos: { x: 11.4, y: 0, z: 2.1 }, rotY: 1.57 },
    { id: "obj_lv_table", objectSkuId: "o_table_01", name: "센터 테이블", pos: { x: 8.9, y: 0, z: 2.2 }, rotY: 0.0 },
    { id: "obj_lv_rug", objectSkuId: "o_rug_01", name: "러그", pos: { x: 8.8, y: 0, z: 2.1 }, rotY: 0.0 },
    { id: "obj_lv_dining", objectSkuId: "o_table_02", name: "식탁", pos: { x: 6.4, y: 0, z: 1.3 }, rotY: 1.57 },
    { id: "obj_lv_chair_1", objectSkuId: "o_chair_01", name: "식탁 의자", pos: { x: 6.0, y: 0, z: 0.7 }, rotY: 0.0 },
    { id: "obj_lv_chair_2", objectSkuId: "o_chair_01", name: "식탁 의자", pos: { x: 6.8, y: 0, z: 0.7 }, rotY: 0.0 },
    { id: "obj_lv_desk", objectSkuId: "o_desk_01", name: "워크 데스크", pos: { x: 6.3, y: 0, z: 3.3 }, rotY: 0.0 },
    { id: "obj_lv_pc", objectSkuId: "o_pc_01", name: "PC", pos: { x: 6.8, y: 0, z: 3.3 }, rotY: 0.0 },
    { id: "obj_lv_plant", objectSkuId: "o_plant_01", name: "플랜트", pos: { x: 11.0, y: 0, z: 0.7 }, rotY: 0.0 },

    { id: "obj_b1_bed", objectSkuId: "o_bed_01", name: "침대(1)", pos: { x: 2.1, y: 0, z: 1.2 }, rotY: 0.0 },
    { id: "obj_b1_wardrobe", objectSkuId: "o_wardrobe_01", name: "옷장", pos: { x: 0.7, y: 0, z: 0.6 }, rotY: 0.0 },
    { id: "obj_b2_bed", objectSkuId: "o_bed_01", name: "침대(2)", pos: { x: 2.1, y: 0, z: 3.7 }, rotY: 0.0 },
    { id: "obj_b2_desk", objectSkuId: "o_desk_01", name: "데스크", pos: { x: 3.2, y: 0, z: 4.55 }, rotY: 1.57 },
    { id: "obj_b3_bed", objectSkuId: "o_bed_01", name: "침대(3)", pos: { x: 2.1, y: 0, z: 6.1 }, rotY: 0.0 },
    { id: "obj_b3_wardrobe", objectSkuId: "o_wardrobe_01", name: "옷장", pos: { x: 0.7, y: 0, z: 6.6 }, rotY: 0.0 },

    { id: "obj_k_island", objectSkuId: "o_island_01", name: "아일랜드", pos: { x: 6.6, y: 0, z: 5.6 }, rotY: 0.0 },
    { id: "obj_k_counter", objectSkuId: "o_counter_01", name: "싱크대", pos: { x: 5.1, y: 0, z: 6.9 }, rotY: 0.0 },
    { id: "obj_k_fridge", objectSkuId: "o_fridge_01", name: "냉장고", pos: { x: 5.0, y: 0, z: 4.35 }, rotY: 0.0 },

    { id: "obj_e_shoes", objectSkuId: "o_cabinet_01", name: "신발장", pos: { x: 10.8, y: 0, z: 4.75 }, rotY: 1.57 },
    { id: "obj_bath_tub", objectSkuId: "o_tub_01", name: "욕조", pos: { x: 10.4, y: 0, z: 6.55 }, rotY: 0.0 },
    { id: "obj_bath_sink", objectSkuId: "o_sink_01", name: "세면대", pos: { x: 9.6, y: 0, z: 6.25 }, rotY: 1.57 },
    { id: "obj_bath_wc", objectSkuId: "o_wc_01", name: "변기", pos: { x: 11.0, y: 0, z: 6.9 }, rotY: -1.57 }
  ]
};

export function cloneDesignDoc(doc: DesignDoc): DesignDoc {
  if (typeof structuredClone === "function") return structuredClone(doc);
  return JSON.parse(JSON.stringify(doc)) as DesignDoc;
}

export function createStarterDesignDoc(projectId: string): DesignDoc {
  const doc = cloneDesignDoc(STARTER_ROOM_TEMPLATE);
  doc.id = `draft_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  doc.projectId = projectId;
  doc.revision = 0;
  return doc;
}
