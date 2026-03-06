import { backendFetch } from "../../lib/backend/client";

type UploadUrlResponse = {
  objectPath: string;
  signedUploadUrl: string;
  expiresAt?: string | null;
};

type RegisterFloorplanResponse = {
  floorplanId: string;
  jobId: string;
  floorplanStatus: string;
  jobStatus: string;
};

type LatestSceneResponse = {
  project: Record<string, unknown>;
  floorplan: Record<string, unknown> | null;
  result: {
    floorplanId: string;
    wallCoordinates: unknown[];
    roomPolygons: unknown[];
    scale: number;
    sceneJson: Record<string, unknown>;
    diagnostics?: Record<string, unknown>;
  } | null;
  latestVersion?: Record<string, unknown> | null;
};

export async function requestFloorplanUploadUrl(payload: {
  projectId: string;
  fileName: string;
  mimeType: string;
  size: number;
}) {
  return backendFetch<UploadUrlResponse>("/v1/floorplans/upload-url", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function uploadFloorplanFile(signedUploadUrl: string, file: File, mimeType: string) {
  const response = await fetch(signedUploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": mimeType,
      "x-upsert": "true"
    },
    body: file
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Failed to upload floorplan file (${response.status}): ${details}`);
  }
}

export async function registerFloorplanJob(payload: {
  projectId: string;
  objectPath: string;
  originalFileName: string;
  mimeType: string;
  width?: number;
  height?: number;
}) {
  return backendFetch<RegisterFloorplanResponse>(`/v1/projects/${payload.projectId}/floorplans`, {
    method: "POST",
    body: JSON.stringify({
      objectPath: payload.objectPath,
      originalFileName: payload.originalFileName,
      mimeType: payload.mimeType,
      width: payload.width,
      height: payload.height
    })
  });
}

export async function createFloorplanPipelineJob(projectId: string, file: File) {
  const upload = await requestFloorplanUploadUrl({
    projectId,
    fileName: file.name || "floorplan.png",
    mimeType: file.type || "image/png",
    size: file.size
  });

  await uploadFloorplanFile(upload.signedUploadUrl, file, file.type || "image/png");

  const image = await createImageBitmap(file);
  const width = image.width;
  const height = image.height;
  image.close();

  const registered = await registerFloorplanJob({
    projectId,
    objectPath: upload.objectPath,
    originalFileName: file.name || "floorplan.png",
    mimeType: file.type || "image/png",
    width,
    height
  });

  return {
    floorplanId: registered.floorplanId,
    jobId: registered.jobId,
    objectPath: upload.objectPath
  };
}

export async function fetchFloorplanResult(floorplanId: string) {
  return backendFetch<{
    floorplanId: string;
    wallCoordinates: unknown[];
    roomPolygons: unknown[];
    scale: number;
    sceneJson: Record<string, unknown>;
    diagnostics?: Record<string, unknown>;
  }>(`/v1/floorplans/${floorplanId}/result`);
}

export async function fetchLatestProjectScene(projectId: string) {
  return backendFetch<LatestSceneResponse>(`/v1/projects/${projectId}/scene/latest`);
}
