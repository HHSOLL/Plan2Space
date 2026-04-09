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
import { resolveLatestVersion } from "../services/scene-service";
import { buildProjectVersionCustomization, buildProjectVersionFloorPlan } from "../services/project-version-service";

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
  lighting: z
    .object({
      ambientIntensity: z.number(),
      hemisphereIntensity: z.number(),
      directionalIntensity: z.number(),
      environmentBlur: z.number()
    })
    .optional(),
  thumbnailDataUrl: z.string().nullable().optional(),
  assetSummary: z
    .object({
      totalAssets: z.number(),
      highlightedItems: z
        .array(
          z.object({
            catalogItemId: z.string().nullable(),
            assetId: z.string(),
            label: z.string(),
            category: z.string(),
            collection: z.string(),
            tone: z.enum(["sand", "olive", "slate", "ember"]),
            count: z.number()
          })
        )
        .default([]),
      collections: z
        .array(
          z.object({
            label: z.string(),
            count: z.number()
          })
        )
        .default([]),
      uncataloguedCount: z.number(),
      primaryTone: z.enum(["sand", "olive", "slate", "ember"]),
      primaryCollection: z.string().nullable()
    })
    .nullable()
    .optional(),
  projectName: z.string().optional(),
  projectDescription: z.string().nullable().optional()
});

function dataUrlToBuffer(dataUrl: string) {
  const [header, payload = ""] = dataUrl.split(",", 2);
  const mimeMatch = header?.match(/^data:([^;,]+)/);
  const mime = mimeMatch?.[1] ?? "image/png";
  const isBase64 = header?.includes(";base64");
  return {
    mime,
    buffer: Buffer.from(isBase64 ? payload : decodeURIComponent(payload), isBase64 ? "base64" : "utf8")
  };
}

function mimeToExtension(mime: string) {
  if (mime === "image/svg+xml") return "svg";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  return "bin";
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

projectsRouter.get("/projects/:projectId/versions/latest", async (request, response, next) => {
  try {
    const ownerId = request.user?.id;
    if (!ownerId) throw new ApiError(401, "Unauthorized");
    const project = await getProject(ownerId, request.params.projectId);
    if (!project) throw new ApiError(404, "Project not found.");
    const version = await resolveLatestVersion(request.params.projectId);
    response.status(200).json({ version: version ?? null });
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
    const nextMeta: Record<string, unknown> = {
      ...(project.metadata ?? {})
    };
    if (payload.thumbnailDataUrl) {
      const parsed = dataUrlToBuffer(payload.thumbnailDataUrl);
      snapshotPath = `${ownerId}/${request.params.projectId}/thumbnail-${Date.now()}.${mimeToExtension(parsed.mime)}`;
      const upload = await supabaseService.storage.from(env.FLOORPLAN_UPLOAD_BUCKET).upload(snapshotPath, parsed.buffer, {
        contentType: parsed.mime,
        upsert: true
      });
      if (upload.error) throw upload.error;

      nextMeta.thumbnailBucket = env.FLOORPLAN_UPLOAD_BUCKET;
    }

    if (payload.assetSummary !== undefined) {
      nextMeta.assetSummary = payload.assetSummary;
    }

    if (snapshotPath || payload.assetSummary !== undefined) {
      const { error: updateProjectError } = await supabaseService
        .from("projects")
        .update({
          ...(snapshotPath ? { thumbnail_path: snapshotPath } : {}),
          meta: nextMeta
        })
        .eq("id", request.params.projectId)
        .eq("owner_id", ownerId);
      if (updateProjectError) throw updateProjectError;
    }

    const floorPlan = buildProjectVersionFloorPlan({
      scale: payload.topology.scale,
      scaleInfo: payload.topology.scaleInfo,
      walls: payload.topology.walls as Array<Record<string, unknown>>,
      openings: payload.topology.openings as Array<Record<string, unknown>>,
      floors: Array.isArray(payload.topology.floors) ? (payload.topology.floors as Array<Record<string, unknown>>) : []
    });
    const customization = buildProjectVersionCustomization(
      payload.assets as Array<Record<string, unknown>>,
      payload.materials,
      payload.lighting
    );

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
