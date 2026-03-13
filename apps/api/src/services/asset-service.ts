import { createAssetGenerationJob } from "../repositories/jobs-repo";

export async function createAssetGenerationJobForOwner(ownerId: string, payload: {
  image: string;
  fileName?: string;
  provider?: "triposr" | "meshy";
}) {
  return createAssetGenerationJob({
    ownerId,
    image: payload.image,
    fileName: payload.fileName,
    provider: payload.provider
  });
}
