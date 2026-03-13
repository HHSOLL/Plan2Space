import { create } from "zustand";

export type Vector2 = [number, number];
export type Vector3 = [number, number, number];
export type ScaleSource = "ocr_dimension" | "door_heuristic" | "user_measure" | "unknown";

export type ScaleEvidence = {
  mmValue?: number;
  pxDistance?: number;
  p1?: Vector2;
  p2?: Vector2;
  ocrText?: string;
  ocrBox?: { x: number; y: number; w: number; h: number };
  notes?: string;
};

export type ScaleInfo = {
  value: number;
  source: ScaleSource;
  confidence: number;
  evidence?: ScaleEvidence;
};

export type Wall = {
  id: string;
  start: Vector2;
  end: Vector2;
  thickness: number;
  height: number;
  confidence?: number;
  type?: "exterior" | "interior" | "balcony" | "column";
  isPartOfBalcony?: boolean;
};

export type RoomType =
  | "living_room"
  | "bedroom"
  | "kitchen"
  | "dining"
  | "bathroom"
  | "foyer"
  | "corridor"
  | "balcony"
  | "utility"
  | "pantry"
  | "dress_room"
  | "alpha_room"
  | "service_area"
  | "evacuation_space"
  | "other";

export type Opening = {
  id: string;
  wallId: string;
  type: "door" | "window";
  offset: number;
  width: number;
  height: number;
  verticalOffset?: number;
  sillHeight?: number;
  isEntrance?: boolean;
  detectConfidence?: number;
  attachConfidence?: number;
  typeConfidence?: number;
};

export type Floor = {
  id: string;
  outline: Vector2[];
  materialId: string | null;
  roomId?: string | null;
  roomType?: RoomType;
  label?: string;
};

export type Ceiling = {
  id: string;
  outline: Vector2[];
  materialId: string | null;
  roomId?: string | null;
  roomType?: RoomType;
  height: number;
};

export type RoomZone = {
  id: string;
  roomType: RoomType;
  label: string;
  polygon: Vector2[];
  area: number;
  center: Vector2;
  openingIds: string[];
  connectedRoomIds: string[];
  estimatedCeilingHeight: number;
  estimatedUsage: "primary" | "secondary" | "service";
  isExteriorFacing: boolean;
};

export type CameraAnchor = {
  id: string;
  kind: "entrance" | "room_center" | "overview";
  roomId: string | null;
  openingId: string | null;
  planPosition: Vector2;
  targetPlanPosition: Vector2;
  height: number;
};

export type NavGraphNode = {
  id: string;
  roomId: string | null;
  kind: "entrance" | "room_center";
  planPosition: Vector2;
};

export type NavGraphEdge = {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  relation: "door" | "passage" | "entrance";
  openingId: string;
};

export type NavGraph = {
  nodes: NavGraphNode[];
  edges: NavGraphEdge[];
};

export type SceneAsset = {
  id: string;
  assetId: string;
  position: Vector3;
  rotation: Vector3;
  scale: Vector3;
  materialId: string | null;
};

export type MaterialRef = {
  id: string;
  name: string;
  type: "floor" | "wall" | "ceiling" | "asset";
};

export type Comment = {
  id: string;
  userId: string;
  text: string;
  createdAt: string;
};

export type Activity = {
  id: string;
  userId: string;
  action: string;
  timestamp: string;
};

export type ProjectSnapshot = {
  id: string;
  timestamp: number;
  label: string;
  scale: number;
  scaleInfo: ScaleInfo;
  walls: Wall[];
  openings: Opening[];
  floors: Floor[];
  ceilings: Ceiling[];
  rooms: RoomZone[];
  cameraAnchors: CameraAnchor[];
  navGraph: NavGraph;
  assets: SceneAsset[];
};

export type VersionHistory = {
  snapshots: ProjectSnapshot[];
  currentIndex: number;
};

type SceneDataState = {
  scale: number;
  scaleInfo: ScaleInfo;
  walls: Wall[];
  openings: Opening[];
  floors: Floor[];
  ceilings: Ceiling[];
  rooms: RoomZone[];
  cameraAnchors: CameraAnchor[];
  navGraph: NavGraph;
  assets: SceneAsset[];
  materials: Record<string, MaterialRef>;
  wallMaterialIndex: number;
  floorMaterialIndex: number;
  selectedAssetId: string | null;
  entranceId: string | null;
  commentsByAsset: Record<string, Comment[]>;
  activities: Activity[];
  versionHistory: VersionHistory;
  lastSnapshotTime: number;
};

type SceneState = SceneDataState & {
  setWalls: (walls: Wall[]) => void;
  setOpenings: (openings: Opening[]) => void;
  setFloors: (floors: Floor[]) => void;
  setCeilings: (ceilings: Ceiling[]) => void;
  setRooms: (rooms: RoomZone[]) => void;
  setCameraAnchors: (cameraAnchors: CameraAnchor[]) => void;
  setNavGraph: (navGraph: NavGraph) => void;
  setAssets: (assets: SceneAsset[]) => void;
  setScale: (scale: number, scaleInfo?: ScaleInfo) => void;
  setScaleInfo: (scaleInfo: ScaleInfo) => void;
  setWallMaterialIndex: (index: number) => void;
  setFloorMaterialIndex: (index: number) => void;
  setSelectedAssetId: (id: string | null) => void;
  addFurniture: (asset: Omit<SceneAsset, "id"> & { id?: string }) => void;
  updateFurniture: (id: string, updates: Partial<SceneAsset>) => void;
  removeFurniture: (id: string) => void;
  upsertMaterial: (material: MaterialRef) => void;
  addComment: (assetId: string, comment: Comment) => void;
  logActivity: (userId: string, action: string) => void;
  createSnapshot: (label?: string) => void;
  undo: () => void;
  redo: () => void;
  restoreSnapshot: (id: string) => void;
  setScene: (scene: Partial<SceneDataState>) => void;
  resetScene: () => void;
};

const makeUnknownScaleInfo = (value = 1): ScaleInfo => ({
  value,
  source: "unknown",
  confidence: 0,
  evidence: {
    notes: "Scale has not been calibrated."
  }
});

const initialSceneState: SceneDataState = {
  scale: 1,
  scaleInfo: makeUnknownScaleInfo(1),
  walls: [],
  openings: [],
  floors: [],
  ceilings: [],
  rooms: [],
  cameraAnchors: [],
  navGraph: {
    nodes: [],
    edges: []
  },
  assets: [],
  materials: {},
  wallMaterialIndex: 0,
  floorMaterialIndex: 0,
  selectedAssetId: null,
  entranceId: null,
  commentsByAsset: {},
  activities: [],
  versionHistory: {
    snapshots: [],
    currentIndex: -1
  },
  lastSnapshotTime: 0
};

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `asset-${Math.random().toString(36).slice(2, 10)}`;
};

export const useSceneStore = create<SceneState>((set) => ({
  ...initialSceneState,
  setWalls: (walls) => set({ walls }),
  setOpenings: (openings) => set({ openings }),
  setFloors: (floors) => set({ floors }),
  setCeilings: (ceilings) => set({ ceilings }),
  setRooms: (rooms) => set({ rooms }),
  setCameraAnchors: (cameraAnchors) => set({ cameraAnchors }),
  setNavGraph: (navGraph) => set({ navGraph }),
  setAssets: (assets) => set({ assets }),
  setScale: (scale, scaleInfo) =>
    set((state) => ({
      scale,
      scaleInfo: scaleInfo ? { ...scaleInfo, value: scale } : { ...state.scaleInfo, value: scale }
    })),
  setScaleInfo: (scaleInfo) =>
    set(() => ({
      scale: scaleInfo.value,
      scaleInfo
    })),
  setWallMaterialIndex: (index) => set({ wallMaterialIndex: index }),
  setFloorMaterialIndex: (index) => set({ floorMaterialIndex: index }),
  setSelectedAssetId: (id) => set({ selectedAssetId: id }),
  addFurniture: (asset) =>
    set((state) => {
      const newAssets = [
        ...state.assets,
        {
          id: asset.id ?? createId(),
          assetId: asset.assetId,
          position: asset.position,
          rotation: asset.rotation,
          scale: asset.scale,
          materialId: asset.materialId ?? null
        }
      ];
      return { assets: newAssets };
    }),
  updateFurniture: (id, updates) =>
    set((state) => ({
      assets: state.assets.map((asset) => (asset.id === id ? { ...asset, ...updates } : asset))
    })),
  removeFurniture: (id) =>
    set((state) => ({
      assets: state.assets.filter((asset) => asset.id !== id),
      selectedAssetId: state.selectedAssetId === id ? null : state.selectedAssetId
    })),
  upsertMaterial: (material) =>
    set((state) => ({
      materials: { ...state.materials, [material.id]: material }
    })),
  addComment: (assetId, comment) =>
    set((state) => ({
      commentsByAsset: {
        ...state.commentsByAsset,
        [assetId]: [...(state.commentsByAsset[assetId] ?? []), comment]
      }
    })),
  logActivity: (userId, action) =>
    set((state) => ({
      activities: [
        {
          id: createId(),
          userId,
          action,
          timestamp: new Date().toISOString()
        },
        ...state.activities
      ].slice(0, 50)
    })),
  createSnapshot: (label) =>
    set((state) => {
      const timestamp = Date.now();
      const snapshot: ProjectSnapshot = {
        id: `snapshot-${timestamp}`,
        timestamp,
        label: label ?? `Snapshot ${new Date(timestamp).toLocaleTimeString()}`,
        scale: state.scale,
        scaleInfo: state.scaleInfo,
        walls: state.walls,
        openings: state.openings,
        floors: state.floors,
        ceilings: state.ceilings,
        rooms: state.rooms,
        cameraAnchors: state.cameraAnchors,
        navGraph: state.navGraph,
        assets: state.assets
      };
      const newSnapshots = state.versionHistory.snapshots.slice(0, state.versionHistory.currentIndex + 1);
      newSnapshots.push(snapshot);
      return {
        versionHistory: {
          snapshots: newSnapshots,
          currentIndex: newSnapshots.length - 1
        },
        lastSnapshotTime: timestamp
      };
    }),
  undo: () =>
    set((state) => {
      const { snapshots, currentIndex } = state.versionHistory;
      if (currentIndex <= 0) return state;
      const prev = snapshots[currentIndex - 1];
      return {
        scale: prev.scale,
        scaleInfo: prev.scaleInfo ?? makeUnknownScaleInfo(prev.scale),
        walls: prev.walls,
        openings: prev.openings,
        floors: prev.floors,
        ceilings: prev.ceilings,
        rooms: prev.rooms,
        cameraAnchors: prev.cameraAnchors,
        navGraph: prev.navGraph,
        assets: prev.assets,
        versionHistory: { ...state.versionHistory, currentIndex: currentIndex - 1 }
      };
    }),
  redo: () =>
    set((state) => {
      const { snapshots, currentIndex } = state.versionHistory;
      if (currentIndex >= snapshots.length - 1) return state;
      const next = snapshots[currentIndex + 1];
      return {
        scale: next.scale,
        scaleInfo: next.scaleInfo ?? makeUnknownScaleInfo(next.scale),
        walls: next.walls,
        openings: next.openings,
        floors: next.floors,
        ceilings: next.ceilings,
        rooms: next.rooms,
        cameraAnchors: next.cameraAnchors,
        navGraph: next.navGraph,
        assets: next.assets,
        versionHistory: { ...state.versionHistory, currentIndex: currentIndex + 1 }
      };
    }),
  restoreSnapshot: (id) =>
    set((state) => {
      const index = state.versionHistory.snapshots.findIndex((s) => s.id === id);
      if (index === -1) return state;
      const snapshot = state.versionHistory.snapshots[index];
      return {
        scale: snapshot.scale,
        scaleInfo: snapshot.scaleInfo ?? makeUnknownScaleInfo(snapshot.scale),
        walls: snapshot.walls,
        openings: snapshot.openings,
        floors: snapshot.floors,
        ceilings: snapshot.ceilings,
        rooms: snapshot.rooms,
        cameraAnchors: snapshot.cameraAnchors,
        navGraph: snapshot.navGraph,
        assets: snapshot.assets,
        versionHistory: { ...state.versionHistory, currentIndex: index }
      };
    }),
  setScene: (scene) =>
    set((state) => {
      const nextScale = typeof scene.scale === "number" ? scene.scale : state.scale;
      const nextScaleInfo =
        scene.scaleInfo ??
        (typeof scene.scale === "number" ? { ...state.scaleInfo, value: scene.scale } : state.scaleInfo);
      return {
        ...scene,
        scale: nextScale,
        scaleInfo: nextScaleInfo
      };
    }),
  resetScene: () => set({ ...initialSceneState })
}));
