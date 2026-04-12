"use client";

import type { ComponentProps } from "react";
import { RoomShellEditor } from "../RoomShellEditor";

export type FloorplanEditorProps = ComponentProps<typeof RoomShellEditor>;

// Legacy compatibility wrapper for older floorplan-based flows.
export function FloorplanEditor(props: FloorplanEditorProps) {
  return <RoomShellEditor {...props} />;
}
