import {
  createProject,
  deleteProject,
  getProjectByOwner,
  listProjectsByOwner,
  updateProject
} from "../repositories/projects-repo";

export async function listProjects(ownerId: string, limit: number, offset: number) {
  return listProjectsByOwner(ownerId, limit, offset);
}

export async function getProject(ownerId: string, projectId: string) {
  return getProjectByOwner(projectId, ownerId);
}

export async function createProjectForOwner(ownerId: string, payload: { name: string; description?: string | null }) {
  return createProject(ownerId, payload);
}

export async function updateProjectForOwner(ownerId: string, projectId: string, payload: { name?: string; description?: string | null }) {
  return updateProject(projectId, ownerId, payload);
}

export async function deleteProjectForOwner(ownerId: string, projectId: string) {
  return deleteProject(projectId, ownerId);
}
