import type { BuilderTemplateId } from "../../lib/builder/templates";

export type BuilderStepId = "shape" | "dimension" | "opening" | "style";

export type BuilderStepMeta = {
  id: BuilderStepId;
  label: string;
  title: string;
  description: string;
};

export type DoorStyle = "single" | "double" | "french";
export type WindowStyle = "single" | "wide";

export type BuilderTemplateOption = {
  id: BuilderTemplateId;
  eyebrow: string;
  name: string;
  description: string;
};

export type BuilderWallEntry = {
  id: string;
  label: string;
  length: number;
};
