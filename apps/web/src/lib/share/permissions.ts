export type SharePermission = "view" | "edit";

export type ShareCapabilities = {
  permission: SharePermission;
  canEditScene: boolean;
  showPreviewNotice: boolean;
  accessLabel: string;
};

export function normalizeSharePermission(permission: string | null | undefined): SharePermission {
  return permission === "edit" ? "edit" : "view";
}

export function resolveShareCapabilities(permission: string | null | undefined): ShareCapabilities {
  const normalized = normalizeSharePermission(permission);
  return {
    permission: normalized,
    canEditScene: false,
    showPreviewNotice: normalized === "edit",
    accessLabel: normalized === "view" ? "View Only" : "Edit Requested · Preview Only"
  };
}
