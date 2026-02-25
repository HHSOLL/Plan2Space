export type UUID = string;

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Vec2 = [number, number]; // [x, z] in meters on the floor plane (Three.js XZ)
export type Vec3 = [number, number, number]; // [x, y, z] in meters (Three.js)

export type Euler = Vec3; // radians, intrinsic XYZ (Three.js default)

export type FloorPlanUnit = "m";

export type OpeningType = "door" | "window";

export type OpeningSwing = "left" | "right" | "cw" | "ccw";

export interface FloorPlanParams {
  wallHeight: number;
  wallThickness: number;
  ceilingHeight: number;
}

export interface FloorPlanWall {
  id: string;
  a: Vec2;
  b: Vec2;
  thickness?: number;
  height?: number;
  locked?: boolean;
  editable?: boolean;
  demolishable?: boolean | "unknown";
}

export interface FloorPlanOpening {
  id: string;
  wallId: string;
  type: OpeningType;
  offset: number; // meters from wall.a along the wall direction
  width: number; // meters
  height: number; // meters
  verticalOffset?: number; // meters (default 0)
  sillHeight?: number; // meters (windows)
  swing?: OpeningSwing; // doors
}

export interface FloorPlanRoom {
  id: string;
  name?: string;
  polygon: Vec2[];
  height?: number; // meters (optional override)
}

export interface FloorPlanDimension {
  id: string;
  kind: "distance";
  from: Vec2;
  to: Vec2;
  value: number; // meters
  label?: string;
  source?: "ai" | "user";
  confidence?: number; // 0..1 (ai)
}

export interface FloorPlanSource {
  kind: "ai_blueprint" | "manual_2d_editor" | "import_dxf" | "import_ifc";
  originalUnits?: "mm" | "m";
  raw?: Json;
  warnings?: string[];
}

export interface FloorPlanData {
  schemaVersion: 1;
  unit: FloorPlanUnit;
  coordSystem: {
    plane: "xz";
    upAxis: "y";
  };
  params: FloorPlanParams;
  walls: FloorPlanWall[];
  openings: FloorPlanOpening[];
  rooms?: FloorPlanRoom[];
  dimensions?: FloorPlanDimension[];
  source?: FloorPlanSource;
}

export type SurfaceId = string;

export interface UVTransform {
  offset?: Vec2;
  repeat?: Vec2;
  rotation?: number; // radians
}

export interface SurfaceMaterialAssignment {
  materialSkuId: string;
  uv?: UVTransform;
  tint?: string; // hex color, e.g. "#ffffff"
}

export interface FurnitureItem {
  id: string;
  modelId: UUID; // references public.assets.id
  name?: string;
  position: Vec3;
  rotation: Euler;
  scale: Vec3;
  anchor?: "floor" | "wall";
  surfaceId?: SurfaceId;
  locked?: boolean;
  metadata?: Json;
}

export interface CustomizationData {
  schemaVersion: 1;
  furniture: FurnitureItem[];
  surfaceMaterials: Record<SurfaceId, SurfaceMaterialAssignment>;
  defaults?: {
    floor?: SurfaceMaterialAssignment;
    wall?: SurfaceMaterialAssignment;
    ceiling?: SurfaceMaterialAssignment;
  };
}

export interface UserPreferences {
  ui?: {
    language?: string;
    theme?: "light" | "dark" | "system";
  };
  units?: {
    length?: "m" | "mm";
  };
  extra?: Record<string, Json>;
}

export interface ProjectMeta {
  import?: {
    sourceType?: "image" | "pdf" | "dxf" | "ifc" | "manual";
    sourcePath?: string;
  };
  thumbnailBucket?: string;
  tags?: string[];
  extra?: Record<string, Json>;
}

export interface AssetBoundingBox {
  min: Vec3;
  max: Vec3;
}

export interface AssetMeta {
  schemaVersion?: 1;
  unit?: "m";
  boundingBox?: AssetBoundingBox;
  pivot?: Vec3;
  defaultTransform?: {
    position?: Vec3;
    rotation?: Euler;
    scale?: Vec3;
  };
  stats?: {
    triangleCount?: number;
    materialCount?: number;
    textureCount?: number;
  };
  extra?: Record<string, Json>;
}

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: UUID;
          display_name: string | null;
          avatar_url: string | null;
          locale: string | null;
          preferences: UserPreferences;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: UUID;
          display_name?: string | null;
          avatar_url?: string | null;
          locale?: string | null;
          preferences?: UserPreferences;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: UUID;
          display_name?: string | null;
          avatar_url?: string | null;
          locale?: string | null;
          preferences?: UserPreferences;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: UUID;
          owner_id: UUID;
          name: string;
          description: string | null;
          thumbnail_path: string | null;
          current_version_id: UUID | null;
          meta: ProjectMeta;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: UUID;
          owner_id: UUID;
          name: string;
          description?: string | null;
          thumbnail_path?: string | null;
          current_version_id?: UUID | null;
          meta?: ProjectMeta;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: UUID;
          owner_id?: UUID;
          name?: string;
          description?: string | null;
          thumbnail_path?: string | null;
          current_version_id?: UUID | null;
          meta?: ProjectMeta;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "projects_current_version_id_fkey";
            columns: ["current_version_id"];
            isOneToOne: false;
            referencedRelation: "project_versions";
            referencedColumns: ["id"];
          }
        ];
      };
      project_versions: {
        Row: {
          id: UUID;
          project_id: UUID;
          version: number;
          created_by: UUID | null;
          message: string | null;
          floor_plan: FloorPlanData;
          customization: CustomizationData;
          snapshot_path: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: UUID;
          project_id: UUID;
          version: number;
          created_by?: UUID | null;
          message?: string | null;
          floor_plan?: FloorPlanData;
          customization?: CustomizationData;
          snapshot_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: UUID;
          project_id?: UUID;
          version?: number;
          created_by?: UUID | null;
          message?: string | null;
          floor_plan?: FloorPlanData;
          customization?: CustomizationData;
          snapshot_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_versions_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          }
        ];
      };
      shared_projects: {
        Row: {
          id: UUID;
          project_id: UUID;
          token: string;
          permissions: string;
          expires_at: string | null;
          created_by: UUID;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: UUID;
          project_id: UUID;
          token: string;
          permissions?: string;
          expires_at?: string | null;
          created_by: UUID;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: UUID;
          project_id?: UUID;
          token?: string;
          permissions?: string;
          expires_at?: string | null;
          created_by?: UUID;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shared_projects_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          }
        ];
      };
      assets: {
        Row: {
          id: UUID;
          owner_id: UUID | null;
          name: string;
          description: string | null;
          category: string;
          tags: string[];
          glb_path: string;
          thumbnail_path: string | null;
          preview_path: string | null;
          meta: AssetMeta;
          is_public: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: UUID;
          owner_id?: UUID | null;
          name: string;
          description?: string | null;
          category?: string;
          tags?: string[];
          glb_path: string;
          thumbnail_path?: string | null;
          preview_path?: string | null;
          meta?: AssetMeta;
          is_public?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: UUID;
          owner_id?: UUID | null;
          name?: string;
          description?: string | null;
          category?: string;
          tags?: string[];
          glb_path?: string;
          thumbnail_path?: string | null;
          preview_path?: string | null;
          meta?: AssetMeta;
          is_public?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_project_version: {
        Args: {
          p_project_id: UUID;
          p_message?: string | null;
          p_floor_plan?: FloorPlanData;
          p_customization?: CustomizationData;
          p_snapshot_path?: string | null;
        };
        Returns: Database["public"]["Tables"]["project_versions"]["Row"];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
