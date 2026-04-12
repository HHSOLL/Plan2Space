export type SharePermission = "view";

export type ShareCapabilities = {
  permission: SharePermission;
  canEditScene: boolean;
  showPreviewNotice: boolean;
  accessLabel: string;
};

export function normalizeSharePermission(_permission: string | null | undefined): SharePermission {
  return "view";
}

export function resolveShareCapabilities(permission: string | null | undefined): ShareCapabilities {
  const normalized = normalizeSharePermission(permission);
  return {
    permission: normalized,
    canEditScene: false,
    showPreviewNotice: false,
    accessLabel: "읽기 전용"
  };
}
