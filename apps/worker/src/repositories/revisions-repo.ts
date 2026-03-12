import { supabaseService } from "../services/supabase";

export async function createLayoutRevision(payload: {
  scope: "canonical" | "candidate" | "private_generated";
  verificationStatus: "unverified" | "verified" | "rejected" | "blocked";
  layoutVariantId?: string | null;
  representativeSourceAssetId?: string | null;
  createdFromIntakeSessionId?: string | null;
  parentRevisionId?: string | null;
  supersedesRevisionId?: string | null;
  promotedFromRevisionId?: string | null;
  demotedFromRevisionId?: string | null;
  geometryJson: Record<string, unknown>;
  topologyHash?: string | null;
  roomGraphHash?: string | null;
  geometryHash: string;
  geometrySchemaVersion: number;
  repairEngineVersion?: string | null;
  sceneBuilderVersion?: string | null;
  derivedSceneJson?: Record<string, unknown>;
  derivedNavJson?: Record<string, unknown>;
  derivedCameraJson?: Record<string, unknown>;
  derivedFromGeometryHash?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { data, error } = await supabaseService
    .from("layout_revisions")
    .insert({
      scope: payload.scope,
      verification_status: payload.verificationStatus,
      layout_variant_id: payload.layoutVariantId ?? null,
      representative_source_asset_id: payload.representativeSourceAssetId ?? null,
      created_from_intake_session_id: payload.createdFromIntakeSessionId ?? null,
      parent_revision_id: payload.parentRevisionId ?? null,
      supersedes_revision_id: payload.supersedesRevisionId ?? null,
      promoted_from_revision_id: payload.promotedFromRevisionId ?? null,
      demoted_from_revision_id: payload.demotedFromRevisionId ?? null,
      geometry_json: payload.geometryJson,
      topology_hash: payload.topologyHash ?? null,
      room_graph_hash: payload.roomGraphHash ?? null,
      geometry_hash: payload.geometryHash,
      geometry_schema_version: payload.geometrySchemaVersion,
      repair_engine_version: payload.repairEngineVersion ?? null,
      scene_builder_version: payload.sceneBuilderVersion ?? null,
      derived_scene_json: payload.derivedSceneJson ?? {},
      derived_nav_json: payload.derivedNavJson ?? {},
      derived_camera_json: payload.derivedCameraJson ?? {},
      derived_from_geometry_hash: payload.derivedFromGeometryHash ?? null,
      metadata: payload.metadata ?? {}
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

export async function createRevisionSourceLink(payload: {
  revisionId: string;
  sourceAssetId: string;
  linkRole: "primary" | "supporting" | "derived_from";
  provenanceStatus: "unverified" | "verified" | "withdrawn" | "blocked";
  consentBasis?: string | null;
}) {
  const { error } = await supabaseService
    .from("revision_source_links")
    .upsert(
      {
        revision_id: payload.revisionId,
        source_asset_id: payload.sourceAssetId,
        link_role: payload.linkRole,
        provenance_status: payload.provenanceStatus,
        consent_basis: payload.consentBasis ?? null,
        withdrawn_at: null
      },
      {
        onConflict: "revision_id,source_asset_id,link_role"
      }
    );

  if (error) throw error;
}
