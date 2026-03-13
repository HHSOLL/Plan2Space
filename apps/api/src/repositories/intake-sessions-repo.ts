import { supabaseService } from "../services/supabase";

type IntakeSessionRow = {
  id: string;
  owner_id: string;
  input_kind: "upload" | "catalog_search" | "remediation";
  status:
    | "created"
    | "uploading"
    | "resolving"
    | "disambiguation_required"
    | "queued"
    | "analyzing"
    | "review_required"
    | "resolved_reuse"
    | "resolved_generated"
    | "finalizing"
    | "failed"
    | "expired";
  version: number;
  declared_apartment_name: string | null;
  declared_type_name: string | null;
  declared_region: string | null;
  file_name: string | null;
  mime_type: string | null;
  object_path: string | null;
  file_sha256: string | null;
  file_phash: string | null;
  width: number | null;
  height: number | null;
  selected_layout_revision_id: string | null;
  generated_floorplan_id: string | null;
  finalized_project_id: string | null;
  resolution_payload: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
};

function mapIntakeSession(row: IntakeSessionRow) {
  return {
    id: row.id,
    ownerId: row.owner_id,
    inputKind: row.input_kind,
    status: row.status,
    version: row.version,
    declaredApartmentName: row.declared_apartment_name,
    declaredTypeName: row.declared_type_name,
    declaredRegion: row.declared_region,
    fileName: row.file_name,
    mimeType: row.mime_type,
    objectPath: row.object_path,
    fileSha256: row.file_sha256,
    filePhash: row.file_phash,
    width: row.width,
    height: row.height,
    selectedLayoutRevisionId: row.selected_layout_revision_id,
    generatedFloorplanId: row.generated_floorplan_id,
    finalizedProjectId: row.finalized_project_id,
    resolutionPayload: row.resolution_payload ?? {},
    created_at: row.created_at,
    updated_at: row.updated_at,
    expires_at: row.expires_at
  };
}

const intakeSessionSelect = [
  "id",
  "owner_id",
  "input_kind",
  "status",
  "version",
  "declared_apartment_name",
  "declared_type_name",
  "declared_region",
  "file_name",
  "mime_type",
  "object_path",
  "file_sha256",
  "file_phash",
  "width",
  "height",
  "selected_layout_revision_id",
  "generated_floorplan_id",
  "finalized_project_id",
  "resolution_payload",
  "created_at",
  "updated_at",
  "expires_at"
].join(", ");

export async function createIntakeSession(ownerId: string, payload: {
  inputKind: "upload" | "catalog_search" | "remediation";
  apartmentName?: string;
  typeName?: string;
  region?: string;
  remediationProjectId?: string;
}) {
  const { data, error } = await supabaseService
    .from("intake_sessions")
    .insert({
      owner_id: ownerId,
      input_kind: payload.inputKind,
      declared_apartment_name: payload.apartmentName ?? null,
      declared_type_name: payload.typeName ?? null,
      declared_region: payload.region ?? null,
      remediation_project_id: payload.remediationProjectId ?? null
    })
    .select(intakeSessionSelect)
    .single();

  if (error) throw error;
  return mapIntakeSession(data as unknown as IntakeSessionRow);
}

export async function getIntakeSessionByOwner(intakeSessionId: string, ownerId: string) {
  const { data, error } = await supabaseService
    .from("intake_sessions")
    .select(intakeSessionSelect)
    .eq("id", intakeSessionId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapIntakeSession(data as unknown as IntakeSessionRow);
}

export async function updateIntakeSessionByOwner(
  intakeSessionId: string,
  ownerId: string,
  updates: Record<string, unknown>
) {
  const { data, error } = await supabaseService
    .from("intake_sessions")
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq("id", intakeSessionId)
    .eq("owner_id", ownerId)
    .select(intakeSessionSelect)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapIntakeSession(data as unknown as IntakeSessionRow);
}

export async function finalizeIntakeSessionForOwner(
  intakeSessionId: string,
  ownerId: string,
  payload: { name: string; description?: string | null }
) {
  const { data, error } = await supabaseService.rpc("finalize_intake_session", {
    p_intake_session_id: intakeSessionId,
    p_owner_id: ownerId,
    p_name: payload.name,
    p_description: payload.description ?? null
  });

  if (error) throw error;
  if (!Array.isArray(data) || data.length === 0) return null;
  return data[0] as {
    id: string;
    owner_id: string;
    name: string;
    description: string | null;
    source_layout_revision_id: string | null;
    resolution_state: string | null;
    created_from_intake_session_id: string | null;
    created_at: string;
    updated_at: string;
  };
}
