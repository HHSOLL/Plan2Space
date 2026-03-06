import { claimNextJobs } from "../repositories/jobs-repo";

export async function claimNextFloorplanJobs(workerId: string, limit: number) {
  return claimNextJobs(workerId, limit);
}
