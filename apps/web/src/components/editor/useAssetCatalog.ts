"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_CATALOG,
  filterCatalogItems,
  getCatalogSpotlight,
  getFeaturedCatalogItems,
  getLibraryCategories,
  normalizeCatalog,
  type LibraryCatalogCategoryId,
  type LibraryCatalogItem
} from "../../lib/builder/catalog";

export function useAssetCatalog() {
  const [catalog, setCatalog] = useState<LibraryCatalogItem[]>(DEFAULT_CATALOG);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<LibraryCatalogCategoryId>("all");

  useEffect(() => {
    let active = true;

    fetch("/assets/catalog/manifest.json")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("Asset catalog missing"))))
      .then((data) => {
        if (!active) return;
        setCatalog(normalizeCatalog(data));
      })
      .catch(() => {
        if (active) {
          setCatalog(DEFAULT_CATALOG);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const categories = useMemo(() => getLibraryCategories(catalog), [catalog]);
  const filteredItems = useMemo(
    () =>
      filterCatalogItems(catalog, {
        query,
        categoryId: activeCategory
      }),
    [activeCategory, catalog, query]
  );
  const featuredItems = useMemo(() => getFeaturedCatalogItems(catalog), [catalog]);
  const spotlightItem = useMemo(
    () => getCatalogSpotlight(filteredItems, featuredItems),
    [featuredItems, filteredItems]
  );

  return {
    catalog,
    categories,
    query,
    setQuery,
    activeCategory,
    setActiveCategory,
    filteredItems,
    featuredItems,
    spotlightItem,
    hasActiveFilters: activeCategory !== "all" || query.trim().length > 0
  };
}
