"use client";

import { useEffect, useRef } from "react";
import type { CustomizationData, FurnitureItem } from "../../../types/database";
import { useDesignStore } from "../store/useDesignStore";

export function unpackCustomization(customization: CustomizationData | null | undefined): FurnitureItem[] {
  if (!customization) return [];
  if (customization.schemaVersion !== 1) return [];
  if (!Array.isArray(customization.furniture)) return [];
  return customization.furniture;
}

export function packCustomization(furniture: FurnitureItem[]): CustomizationData {
  return {
    schemaVersion: 1,
    furniture,
    surfaceMaterials: {}
  };
}

export function useProjectData(initialCustomization: CustomizationData | null | undefined) {
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;

    useDesignStore.setState({
      furniture: unpackCustomization(initialCustomization),
      selectedItemId: null
    });
  }, [initialCustomization]);
}

