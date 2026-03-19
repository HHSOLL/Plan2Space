import { Router } from "express";
import { z } from "zod";
import {
  createProjectForOwner,
  deleteProjectForOwner,
  getProject,
  invalidateReuseForOwner,
  listProjects,
  updateProjectForOwner
} from "../services/project-service";
import { ApiError } from "../services/errors";
import { createAuthedSupabaseClient, supabaseService } from "../services/supabase";
import { env } from "../config/env";
import { createIntakeSessionForOwner } from "../services/intake-service";

const CreateProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional()
});

const UpdateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional()
});

const SaveVersionSchema = z.object({
  message: z.string().optional(),
  topology: z.object({
    scale: z.number(),
    scaleInfo: z.record(z.string(), z.unknown()).optional(),
    walls: z.array(z.record(z.string(), z.unknown())),
    openings: z.array(z.record(z.string(), z.unknown())),
    floors: z.array(z.record(z.string(), z.unknown())).optional()
  }),
  assets: z.array(z.record(z.string(), z.unknown())).default([]),
  materials: z.object({
    wallIndex: z.number(),
    floorIndex: z.number()
  }),
  thumbnailDataUrl: z.string().nullable().optional(),
  projectName: z.string().optional(),
  projectDescription: z.string().nullable().optional()
});

const DEFAULT_WALL_HEIGHT = 2.8;

function dataUrlToBuffer(dataUrl: string) {
  const [header, base64] = dataUrl.split(",");
  const mimeMatch = header?.match(/data:(.*);base64/);
  const mime = mimeMatch?.[1] ?? "image/png";
  return {
    mime,
    buffer: Buffer.from(base64 ?? "", "base64")
  };
}

function buildFloorPlan(topology: z.infer<typeof SaveVersionSchema>["topology"]) {
  const scale = topology.scale;
  const walls = topology.walls as Array<Record<string, any>>;
  const openings = topology.openings as Array<Record<string, any>>;
  const floors = Array.isArray(topology.floors) ? (topology.floors as Array<Record<string, any>>) : [];
  const wallHeight = walls.reduce((max, wall) => Math.max(max, Number(wall.height) || DEFAULT_WALL_HEIGHT), DEFAULT_WALL_HEIGHT);
  const wallThickness = walls.length > 0 ? Math.max(0.02, Number(walls[0]?.thickness ?? 0.2) * scale) : 0.2;

  return {
    schemaVersion: 1,
    unit: "m",
    coordSystem: {
      plane: "xz",
      upAxis: "y"
    },
    params: {
      wallHeight,
      wallThickness,
      ceilingHeight: wallHeight
    },
    walls: walls.map((wall) => ({
      id: wall.id,
      a: [Number(wall.start?.[0] ?? 0) * scale, Number(wall.start?.[1] ?? 0) * scale],
      b: [Number(wall.end?.[0] ?? 0) * scale, Number(wall.end?.[1] ?? 0) * scale],
      thickness: Number(wall.thickness ?? 12) * scale,
      height: Number(wall.height ?? wallHeight)
    })),
    openings: openings.map((opening) => ({
      id: opening.id,
      wallId: opening.wallId,
      type: opening.type,
      offset: Number(opening.offset ?? 0) * scale,
      width: Number(opening.width ?? 90) * scale,
      height: Number(opening.height ?? 210) * scale,
      verticalOffset:
        typeof opening.verticalOffset === "number" ? Number(opening.verticalOffset) * scale : undefined,
      sillHeight: typeof opening.sillHeight === "number" ? Number(opening.sillHeight) * scale : undefined
    })),
    source: {
      kind: "manual_2d_editor",
      raw: topology.scaleInfo
        ? {
            scaleInfo: topology.scaleInfo
          }
        : undefined
    },
    floors: floors.map((floor) => ({
      id: floor.id,
      outline: Array.isArray(floor.outline)
        ? floor.outline.map((point: unknown) => [
            Number((point as [number, number])?.[0] ?? 0) * scale,
            Number((point as [number, number])?.[1] ?? 0) * scale
          ])
        : [],
      materialId: typeof floor.materialId === "string" ? floor.materialId : null
    }))
  };
}

function buildCustomization(payload: z.infer<typeof SaveVersionSchema>) {
  return {
    schemaVersion: 1,
    furniture: payload.assets.map((asset: Record<string, any>) => ({
      id: asset.id,
      modelId: asset.assetId,
      position: asset.position,
      rotation: asset.rotation,
      scale: asset.scale,
      metadata: {
        path: asset.assetId
      }
    })),
    surfaceMaterials: {},
    defaults: {
      floor: {
        materialSkuId: `floor:${payload.materials.floorIndex}`
      },
      wall: {
        materialSkuId: `wall:${payload.materials.wallIndex}`
      }
    }
  };
}

export const projectsRouter = Router();

projectsRouter.get("/projects", async (request, response, next) => {
  try {
    const ownerId = request.user?.id;
    if (!ownerId) throw new ApiError(401, "Unauthorized");
    const limit = Math.min(Math.max(Number(request.query.limit ?? 20), 1), 100);
    const offset = Math.max(Number(request.query.offset ?? 0), 0);

    const result = await listProjects(ownerId, limit, offset);
    response.status(200).json({
      items: result.items,
      total: result.total,
      nextCursor: result.total > offset + result.items.length ? String(offset + result.items.length) : null
    });
  } catch (error) {
    next(error);
  }
});

projectsRouter.post("/projects", async (request, response, next) => {
  try {
    const ownerId = request.user?.id;
    if (!ownerId) throw new ApiError(401, "Unauthorized");
    const payload = CreateProjectSchema.parse(request.body);
    const project = await createProjectForOwner(ownerId, payload);
    response.status(201).json(project);
  } catch (error) {
    next(error);
  }
});

projectsRouter.get("/projects/:projectId", async (request, response, next) => {
  try {
    const ownerId = request.user?.id;
    if (!ownerId) throw new ApiError(401, "Unauthorized");
    const project = await getProject(ownerId, request.params.projectId);
    if (!project) throw new ApiError(404, "Project not found.");
    response.status(200).json({ project });
  } catch (error) {
    next(error);
  }
});

projectsRouter.put("/projects/:projectId", async (request, response, next) => {
  try {
    const ownerId = request.user?.id;
    if (!ownerId) throw new ApiError(401, "Unauthorized");
    const payload = UpdateProjectSchema.parse(request.body);
    const project = await updateProjectForOwner(ownerId, request.params.projectId, payload);
    if (!project) throw new ApiError(404, "Project not found.");
    response.status(200).json(project);
  } catch (error) {
    next(error);
  }
});

projectsRouter.delete("/projects/:projectId", async (request, response, next) => {
  try {
    const ownerId = request.user?.id;
    if (!ownerId) throw new ApiError(401, "Unauthorized");
    const deleted = await deleteProjectForOwner(ownerId, request.params.projectId);
    if (!deleted) throw new ApiError(404, "Project not found.");
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});

projectsRouter.post("/projects/:projectId/reuse-invalidated", async (request, response, next) => {
  try {
    const ownerId = request.user?.id;
    if (!ownerId) throw new ApiError(401, "Unauthorized");

    const project = await invalidateReuseForOwner(ownerId, request.params.projectId);
    if (!project) throw new ApiError(404, "Project not found.");

    const remediationSession = await createIntakeSessionForOwner(ownerId, {
      inputKind: "remediation",
      remediationProjectId: project.id
    });

    response.status(200).json({
      project,
      remediationSession
    });
  } catch (error) {
    next(error);
  }
});

projectsRouter.post("/projects/:projectId/versions", async (request, response, next) => {
  try {
    const ownerId = request.user?.id;
    if (!ownerId) throw new ApiError(401, "Unauthorized");

    const project = await getProject(ownerId, request.params.projectId);
    if (!project) throw new ApiError(404, "Project not found.");

    const payload = SaveVersionSchema.parse(request.body);

    if (payload.projectName || payload.projectDescription !== undefined) {
      await updateProjectForOwner(ownerId, request.params.projectId, {
        ...(payload.projectName ? { name: payload.projectName } : {}),
        ...(payload.projectDescription !== undefined ? { description: payload.projectDescription } : {})
      });
    }

    let snapshotPath: string | null = null;
    if (payload.thumbnailDataUrl) {
      const parsed = dataUrlToBuffer(payload.thumbnailDataUrl);
      snapshotPath = `${ownerId}/${request.params.projectId}/thumbnail-${Date.now()}.png`;
      const upload = await supabaseService.storage.from(env.FLOORPLAN_UPLOAD_BUCKET).upload(snapshotPath, parsed.buffer, {
        contentType: parsed.mime,
        upsert: true
      });
      if (upload.error) throw upload.error;

      const { error: updateProjectError } = await supabaseService
        .from("projects")
        .update({
          thumbnail_path: snapshotPath,
          meta: {
            ...(project.metadata ?? {}),
            thumbnailBucket: env.FLOORPLAN_UPLOAD_BUCKET
          }
        })
        .eq("id", request.params.projectId)
        .eq("owner_id", ownerId);
      if (updateProjectError) throw updateProjectError;
    }

    const floorPlan = buildFloorPlan(payload.topology);
    const customization = buildCustomization(payload);

    const authedSupabase = createAuthedSupabaseClient(request.user.accessToken);
    const { data, error } = await authedSupabase.rpc("create_project_version", {
      p_project_id: request.params.projectId,
      p_message: payload.message ?? "Manual save",
      p_floor_plan: floorPlan,
      p_customization: customization,
      p_snapshot_path: snapshotPath
    });

    if (error) throw error;

    response.status(200).json({ version: data });
  } catch (error) {
    next(error);
  }
});
