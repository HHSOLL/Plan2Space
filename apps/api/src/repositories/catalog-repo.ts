import { supabaseService } from "../services/supabase";

function normalizeSearchText(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export async function searchCatalogCandidates(payload: {
  apartmentName?: string;
  typeName?: string;
  region?: string;
  limit?: number;
}) {
  let query = supabaseService
    .from("catalog_search_index")
    .select(
      "housing_complex_id, layout_family_id, layout_variant_id, layout_revision_id, apartment_name, type_name, region, area_label, variant_label, preview_image_path, verified, match_metadata"
    )
    .eq("blocked", false)
    .eq("verified", true)
    .limit(payload.limit ?? 10);

  const normalizedApartmentName = normalizeSearchText(payload.apartmentName);
  const normalizedTypeName = normalizeSearchText(payload.typeName);
  const normalizedRegion = normalizeSearchText(payload.region);

  if (normalizedApartmentName) {
    query = query.eq("normalized_apartment_name", normalizedApartmentName);
  }
  if (normalizedTypeName) {
    query = query.eq("normalized_type_name", normalizedTypeName);
  }
  if (normalizedRegion) {
    query = query.eq("normalized_region", normalizedRegion);
  }

  const { data, error } = await query.order("updated_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row) => ({
    housingComplexId: row.housing_complex_id,
    layoutFamilyId: row.layout_family_id,
    layoutVariantId: row.layout_variant_id,
    layoutRevisionId: row.layout_revision_id,
    apartmentName: row.apartment_name,
    typeName: row.type_name,
    region: row.region,
    areaLabel: row.area_label,
    variantLabel: row.variant_label,
    previewImagePath: row.preview_image_path,
    verified: Boolean(row.verified),
    matchScore: Number((row.match_metadata as Record<string, unknown> | null)?.matchScore ?? 1),
    matchReasons: Array.isArray((row.match_metadata as Record<string, unknown> | null)?.matchReasons)
      ? (((row.match_metadata as Record<string, unknown>).matchReasons as unknown[]) ?? []).filter(
          (item): item is string => typeof item === "string"
        )
      : []
  }));
}

export async function getCatalogCandidateByRevisionId(layoutRevisionId: string) {
  const { data, error } = await supabaseService
    .from("catalog_search_index")
    .select(
      "housing_complex_id, layout_family_id, layout_variant_id, layout_revision_id, apartment_name, type_name, region, area_label, variant_label, preview_image_path, verified, blocked"
    )
    .eq("layout_revision_id", layoutRevisionId)
    .eq("blocked", false)
    .eq("verified", true)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    housingComplexId: data.housing_complex_id,
    layoutFamilyId: data.layout_family_id,
    layoutVariantId: data.layout_variant_id,
    layoutRevisionId: data.layout_revision_id,
    apartmentName: data.apartment_name,
    typeName: data.type_name,
    region: data.region,
    areaLabel: data.area_label,
    variantLabel: data.variant_label,
    previewImagePath: data.preview_image_path,
    verified: Boolean(data.verified),
    matchScore: 1,
    matchReasons: ["catalog_revision_match"]
  };
}

export async function findVerifiedRevisionBySha256(checksumSha256: string) {
  const { data: sourceAssets, error: sourceAssetsError } = await supabaseService
    .from("source_assets")
    .select("id")
    .eq("checksum_sha256", checksumSha256)
    .neq("provenance_status", "withdrawn")
    .neq("provenance_status", "blocked")
    .limit(5);
  if (sourceAssetsError) throw sourceAssetsError;

  const sourceAssetIds = (sourceAssets ?? []).map((row) => row.id as string);
  if (sourceAssetIds.length === 0) return null;

  const { data: links, error: linksError } = await supabaseService
    .from("revision_source_links")
    .select("revision_id")
    .in("source_asset_id", sourceAssetIds)
    .is("withdrawn_at", null)
    .limit(20);
  if (linksError) throw linksError;

  const revisionIds = Array.from(new Set((links ?? []).map((row) => row.revision_id as string)));
  if (revisionIds.length === 0) return null;

  const { data: revisions, error: revisionsError } = await supabaseService
    .from("layout_revisions")
    .select("id, layout_variant_id, scope, verification_status")
    .in("id", revisionIds)
    .eq("scope", "canonical")
    .eq("verification_status", "verified")
    .limit(5);
  if (revisionsError) throw revisionsError;

  const revision = revisions?.[0];
  if (!revision) return null;

  const candidate = await getCatalogCandidateByRevisionId(revision.id);
  if (!candidate) {
    return {
      layoutRevisionId: revision.id,
      layoutVariantId: revision.layout_variant_id,
      apartmentName: "Verified layout",
      typeName: "Verified layout",
      region: null,
      areaLabel: null,
      variantLabel: null,
      previewImagePath: null,
      verified: true,
      matchScore: 1,
      matchReasons: ["sha256_exact"]
    };
  }

  return {
    ...candidate,
    matchScore: 1,
    matchReasons: ["sha256_exact", ...candidate.matchReasons]
  };
}
