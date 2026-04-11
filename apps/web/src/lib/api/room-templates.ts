"use client";

import {
  builderFloorFinishes,
  builderTemplates,
  builderWallFinishes,
  type BuilderTemplate,
  type BuilderTemplateId
} from "../builder/templates";

export type BuilderFinishOption = {
  id: number;
  name: string;
};

export type RoomTemplateConfig = {
  templates: BuilderTemplate[];
  wallFinishes: BuilderFinishOption[];
  floorFinishes: BuilderFinishOption[];
};

type RoomTemplatePayload = {
  templates?: unknown;
  roomTemplates?: unknown;
  wallFinishes?: unknown;
  floorFinishes?: unknown;
  finishes?: {
    walls?: unknown;
    floors?: unknown;
  };
};

const KNOWN_TEMPLATE_IDS = new Set<BuilderTemplateId>(builderTemplates.map((template) => template.id));

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function normalizeTemplateOverrides(input: unknown) {
  if (!Array.isArray(input)) {
    return new Map<BuilderTemplateId, Partial<BuilderTemplate>>();
  }

  return input.reduce<Map<BuilderTemplateId, Partial<BuilderTemplate>>>((accumulator, item) => {
    if (!item || typeof item !== "object") {
      return accumulator;
    }

    const record = item as Record<string, unknown>;
    const rawId = record.id;

    if (typeof rawId !== "string" || !KNOWN_TEMPLATE_IDS.has(rawId as BuilderTemplateId)) {
      return accumulator;
    }

    const templateId = rawId as BuilderTemplateId;
    const override: Partial<BuilderTemplate> = {};

    if (isNonEmptyString(record.name)) override.name = record.name.trim();
    if (isNonEmptyString(record.eyebrow)) override.eyebrow = record.eyebrow.trim();
    if (isNonEmptyString(record.description)) override.description = record.description.trim();
    if (isNonEmptyString(record.accent)) override.accent = record.accent.trim();
    if (isPositiveNumber(record.defaultWidth)) override.defaultWidth = record.defaultWidth;
    if (isPositiveNumber(record.defaultDepth)) override.defaultDepth = record.defaultDepth;
    if (isPositiveNumber(record.defaultNookWidth)) override.defaultNookWidth = record.defaultNookWidth;
    if (isPositiveNumber(record.defaultNookDepth)) override.defaultNookDepth = record.defaultNookDepth;

    if (Object.keys(override).length > 0) {
      accumulator.set(templateId, override);
    }

    return accumulator;
  }, new Map<BuilderTemplateId, Partial<BuilderTemplate>>());
}

function normalizeFinishOverrides(input: unknown) {
  if (!Array.isArray(input)) {
    return new Map<number, BuilderFinishOption>();
  }

  return input.reduce<Map<number, BuilderFinishOption>>((accumulator, item) => {
    if (!item || typeof item !== "object") {
      return accumulator;
    }

    const record = item as Record<string, unknown>;

    if (typeof record.id !== "number" || !Number.isFinite(record.id) || !isNonEmptyString(record.name)) {
      return accumulator;
    }

    accumulator.set(record.id, {
      id: record.id,
      name: record.name.trim()
    });

    return accumulator;
  }, new Map<number, BuilderFinishOption>());
}

function mergeTemplates(overrides: Map<BuilderTemplateId, Partial<BuilderTemplate>>) {
  return builderTemplates.map((template) => ({
    ...template,
    ...(overrides.get(template.id) ?? {})
  }));
}

function mergeFinishes(
  localFinishes: readonly { id: number; name: string }[],
  overrides: Map<number, BuilderFinishOption>
) {
  return localFinishes.map((finish) => overrides.get(finish.id) ?? { id: finish.id, name: finish.name });
}

export async function fetchRoomTemplateConfig(): Promise<RoomTemplateConfig> {
  const response = await fetch("/api/v1/room-templates", {
    method: "GET",
    headers: {
      Accept: "application/json"
    },
    cache: "no-store",
    credentials: "include"
  });

  const payload = (await response.json().catch(() => null)) as RoomTemplatePayload | null;

  if (!response.ok) {
    throw new Error(`Room template request failed (${response.status})`);
  }

  const templateOverrides = normalizeTemplateOverrides(payload?.templates ?? payload?.roomTemplates);
  const wallFinishOverrides = normalizeFinishOverrides(payload?.wallFinishes ?? payload?.finishes?.walls);
  const floorFinishOverrides = normalizeFinishOverrides(payload?.floorFinishes ?? payload?.finishes?.floors);

  return {
    templates: mergeTemplates(templateOverrides),
    wallFinishes: mergeFinishes(builderWallFinishes, wallFinishOverrides),
    floorFinishes: mergeFinishes(builderFloorFinishes, floorFinishOverrides)
  };
}
