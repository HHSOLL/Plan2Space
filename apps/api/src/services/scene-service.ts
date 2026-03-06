import { getLatestVersion } from "../repositories/results-repo";

export async function resolveLatestVersion(projectId: string) {
  return getLatestVersion(projectId);
}
