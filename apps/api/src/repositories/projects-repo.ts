import { supabaseService } from "../services/supabase";

export async function listProjectsByOwner(ownerId: string, limit: number, offset: number) {
  const { data, error, count } = await supabaseService
    .from("projects")
    .select("id, owner_id, name, description, meta, created_at, updated_at", { count: "exact" })
    .eq("owner_id", ownerId)
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return {
    items: (data ?? []).map((project) => ({
      id: project.id,
      owner_id: project.owner_id,
      name: project.name,
      description: project.description,
      metadata: project.meta ?? undefined,
      created_at: project.created_at,
      updated_at: project.updated_at
    })),
    total: count ?? 0
  };
}

export async function getProjectByOwner(projectId: string, ownerId: string) {
  const { data, error } = await supabaseService
    .from("projects")
    .select("id, owner_id, name, description, meta, created_at, updated_at")
    .eq("id", projectId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    owner_id: data.owner_id,
    name: data.name,
    description: data.description,
    metadata: data.meta ?? undefined,
    created_at: data.created_at,
    updated_at: data.updated_at
  };
}

export async function createProject(ownerId: string, payload: { name: string; description?: string | null }) {
  const { data, error } = await supabaseService
    .from("projects")
    .insert({
      owner_id: ownerId,
      name: payload.name,
      description: payload.description ?? null
    })
    .select("id, owner_id, name, description, meta, created_at, updated_at")
    .single();

  if (error) throw error;
  return {
    id: data.id,
    owner_id: data.owner_id,
    name: data.name,
    description: data.description,
    metadata: data.meta ?? undefined,
    created_at: data.created_at,
    updated_at: data.updated_at
  };
}

export async function updateProject(projectId: string, ownerId: string, payload: { name?: string; description?: string | null }) {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (payload.name !== undefined) updates.name = payload.name;
  if (payload.description !== undefined) updates.description = payload.description;

  const { data, error } = await supabaseService
    .from("projects")
    .update(updates)
    .eq("id", projectId)
    .eq("owner_id", ownerId)
    .select("id, owner_id, name, description, meta, created_at, updated_at")
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    owner_id: data.owner_id,
    name: data.name,
    description: data.description,
    metadata: data.meta ?? undefined,
    created_at: data.created_at,
    updated_at: data.updated_at
  };
}

export async function deleteProject(projectId: string, ownerId: string) {
  const { data, error } = await supabaseService
    .from("projects")
    .delete()
    .eq("id", projectId)
    .eq("owner_id", ownerId)
    .select("id")
    .maybeSingle();

  if (error) throw error;
  return Boolean(data?.id);
}
