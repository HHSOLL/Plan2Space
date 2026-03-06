import { analyzeFloorplanUpload } from "@plan2space/floorplan-core";

export async function executeProviders(payload: { base64: string; mimeType: string; debug?: boolean }) {
  return analyzeFloorplanUpload({
    base64: payload.base64,
    mimeType: payload.mimeType,
    debug: payload.debug
  });
}
