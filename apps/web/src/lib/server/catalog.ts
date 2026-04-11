import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_CATALOG,
  filterCatalogItems,
  getLibraryCategories,
  normalizeCatalog,
  type LibraryCatalogCategory,
  type LibraryCatalogCategoryId,
  type LibraryCatalogItem
} from "../builder/catalog";

export class CatalogApiError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "CatalogApiError";
    this.status = status;
  }
}

export type CatalogBrowseInput = {
  query?: string;
  categoryId?: string;
  limit: number;
  offset: number;
};

export type CatalogBrowseResult = {
  items: LibraryCatalogItem[];
  total: number;
  categories: LibraryCatalogCategory[];
  nextCursor: string | null;
};

const CATALOG_MANIFEST_CANDIDATES = [
  path.join(process.cwd(), "public", "assets", "catalog", "manifest.json"),
  path.join(process.cwd(), "apps", "web", "public", "assets", "catalog", "manifest.json")
] as const;

async function readCatalogManifest() {
  for (const candidate of CATALOG_MANIFEST_CANDIDATES) {
    try {
      const raw = await readFile(candidate, "utf8");
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        throw new CatalogApiError(`Catalog manifest is invalid JSON: ${candidate}`, 500);
      }
    } catch (error) {
      if (error instanceof CatalogApiError) {
        throw error;
      }
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError?.code === "ENOENT") {
        continue;
      }

      throw new CatalogApiError(`Catalog manifest could not be read: ${candidate}`, 500);
    }
  }

  return null;
}

export async function loadCatalogItems(): Promise<LibraryCatalogItem[]> {
  const manifest = await readCatalogManifest();
  return manifest ? normalizeCatalog(manifest) : DEFAULT_CATALOG;
}

function assertCategoryId(categoryId: string, categories: LibraryCatalogCategory[]): LibraryCatalogCategoryId {
  const supportedCategoryIds = new Set(categories.map((category) => category.id));

  if (!supportedCategoryIds.has(categoryId as LibraryCatalogCategoryId)) {
    throw new CatalogApiError("Invalid category query parameter.", 400);
  }

  return categoryId as LibraryCatalogCategoryId;
}

export async function browseCatalog({
  query = "",
  categoryId = "all",
  limit,
  offset
}: CatalogBrowseInput): Promise<CatalogBrowseResult> {
  const catalog = await loadCatalogItems();
  const categories = getLibraryCategories(catalog);
  const resolvedCategoryId = assertCategoryId(categoryId, categories);
  const filtered = filterCatalogItems(catalog, {
    query,
    categoryId: resolvedCategoryId
  });
  const items = filtered.slice(offset, offset + limit);
  const nextCursor = offset + items.length < filtered.length ? String(offset + items.length) : null;

  return {
    items,
    total: filtered.length,
    categories,
    nextCursor
  };
}
