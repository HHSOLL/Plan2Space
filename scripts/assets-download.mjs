#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";

const args = process.argv.slice(2);

const DEFAULT_HDRI = [
  "small_empty_room_1",
  "poly_haven_studio",
  "photo_studio_01",
  "photo_studio_loft_hall",
  "photo_studio_london_hall",
  "brown_photostudio_01",
  "brown_photostudio_05",
  "modern_bathroom",
  "hotel_room",
  "kiara_interior"
];

const DEFAULT_TEXTURES = [
  "wood_floor",
  "weathered_brown_planks",
  "concrete_floor_worn_001",
  "concrete_layers_02",
  "concrete_wall_007",
  "painted_plaster_wall",
  "white_plaster_02",
  "marble_01",
  "laminate_floor_02",
  "linoleum_brown"
];

const FURNITURE_CATEGORIES = new Set([
  "furniture",
  "seating",
  "tables",
  "table",
  "bed",
  "bedroom",
  "storage",
  "lighting",
  "decor",
  "decoration",
  "containers",
  "household",
  "interior",
  "office",
  "electronics",
  "appliances",
  "kitchen",
  "bathroom",
  "props",
  "plants",
  "outdoor"
]);

const FURNITURE_TAGS = new Set([
  "chair",
  "sofa",
  "couch",
  "bed",
  "table",
  "desk",
  "lamp",
  "light",
  "shelf",
  "shelves",
  "cabinet",
  "dresser",
  "wardrobe",
  "stool",
  "bench",
  "mirror",
  "vase",
  "plant",
  "fan",
  "rug",
  "counter",
  "nightstand",
  "drawer",
  "bookshelf",
  "console",
  "lantern",
  "chandelier"
]);

function hasFlag(name) {
  return args.includes(`--${name}`);
}

function getArg(name, fallback) {
  const index = args.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) return fallback;
  return value;
}

const destRoot = getArg("dest", "apps/web/public/assets");
const hdriResolution = getArg("hdri-resolution", "1k");
const textureResolution = getArg("textures-resolution", "2k");
const modelResolution = getArg("models-resolution", "1k");
const modelLimit = Number(getArg("models-limit", "200"));
const dryRun = hasFlag("dry-run");
const skipHdri = hasFlag("skip-hdri");
const skipTextures = hasFlag("skip-textures");
const skipModels = hasFlag("skip-models");

function parseListArg(name, fallback) {
  const raw = getArg(name, "");
  if (!raw) return fallback;
  return raw.split(",").map((entry) => entry.trim()).filter(Boolean);
}

const hdriList = parseListArg("hdri-list", DEFAULT_HDRI);
const textureList = parseListArg("textures-list", DEFAULT_TEXTURES);

async function ensureDir(target) {
  await fs.mkdir(target, { recursive: true });
}

async function fileExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Fetch failed (${response.status}) for ${url}: ${text}`);
  }
  return response.json();
}

async function downloadFile(url, destPath) {
  if (!url) return;
  if (!dryRun && await fileExists(destPath)) return;
  await ensureDir(path.dirname(destPath));
  if (dryRun) {
    console.log(`[dry-run] ${url} -> ${destPath}`);
    return;
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed (${response.status}) for ${url}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(destPath, buffer);
}

async function downloadHdri() {
  if (skipHdri) return;
  const outDir = path.join(destRoot, "hdri");
  const manifest = [];
  for (const asset of hdriList) {
    const files = await fetchJson(`https://api.polyhaven.com/files/${asset}`);
    const hdrInfo = files?.hdri?.[hdriResolution]?.hdr;
    if (!hdrInfo?.url) {
      console.warn(`HDRI not found for ${asset} (${hdriResolution})`);
      continue;
    }
    const fileName = path.basename(hdrInfo.url);
    await downloadFile(hdrInfo.url, path.join(outDir, fileName));
    manifest.push({
      id: asset,
      label: asset.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()),
      path: `/assets/hdri/${fileName}`
    });
  }
  await ensureDir(outDir);
  await fs.writeFile(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`HDRI manifest saved (${manifest.length})`);
}

async function downloadTextures() {
  if (skipTextures) return;
  const outDir = path.join(destRoot, "textures");
  const manifest = [];
  const mapKeys = [
    { key: "Diffuse", name: "diffuse" },
    { key: "Rough", name: "roughness" },
    { key: "nor_gl", name: "normal" },
    { key: "AO", name: "ao" },
    { key: "Displacement", name: "displacement" }
  ];

  for (const asset of textureList) {
    const files = await fetchJson(`https://api.polyhaven.com/files/${asset}`);
    const entry = { id: asset, maps: {} };
    for (const map of mapKeys) {
      const data = files?.[map.key]?.[textureResolution];
      const fileInfo = data?.jpg ?? data?.png;
      if (!fileInfo?.url) continue;
      const fileName = path.basename(fileInfo.url);
      const targetPath = path.join(outDir, asset, fileName);
      await downloadFile(fileInfo.url, targetPath);
      entry.maps[map.name] = `/assets/textures/${asset}/${fileName}`;
    }
    manifest.push(entry);
  }
  await ensureDir(outDir);
  await fs.writeFile(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`Texture manifest saved (${manifest.length})`);
}

async function isFurnitureAsset(asset) {
  const info = await fetchJson(`https://api.polyhaven.com/info/${asset}`);
  const categories = Array.isArray(info.categories) ? info.categories : [];
  const tags = Array.isArray(info.tags) ? info.tags : [];
  const categoryMatch = categories.some((cat) => FURNITURE_CATEGORIES.has(String(cat).toLowerCase()));
  const tagMatch = tags.some((tag) => FURNITURE_TAGS.has(String(tag).toLowerCase()));
  return { match: categoryMatch || tagMatch, info };
}

async function downloadModels() {
  if (skipModels) return;
  const outDir = path.join(destRoot, "models");
  const catalogPath = path.join(destRoot, "catalog", "manifest.json");
  const existingCatalog = await fs.readFile(catalogPath, "utf8").then((raw) => JSON.parse(raw)).catch(() => []);
  const catalogById = new Map(Array.isArray(existingCatalog) ? existingCatalog.map((entry) => [entry.id, entry]) : []);

  const assetsResponse = await fetchJson("https://api.polyhaven.com/assets?t=models");
  const assets = Object.keys(assetsResponse);
  const existingCount = catalogById.size;
  let added = 0;
  const targetTotal = modelLimit;

  for (const asset of assets) {
    if (existingCount + added >= targetTotal) break;
    if (catalogById.has(asset)) continue;
    const { match, info } = await isFurnitureAsset(asset);
    if (!match) continue;

    const files = await fetchJson(`https://api.polyhaven.com/files/${asset}`);
    const gltfData = files?.gltf?.[modelResolution]?.gltf;
    if (!gltfData?.url) {
      console.warn(`GLTF not found for ${asset} (${modelResolution})`);
      continue;
    }
    const assetDir = path.join(outDir, asset);
    const gltfFileName = path.basename(gltfData.url);
    await downloadFile(gltfData.url, path.join(assetDir, gltfFileName));

    const includes = gltfData.include ?? {};
    for (const relPath of Object.keys(includes)) {
      const fileInfo = includes[relPath];
      if (!fileInfo?.url) continue;
      const targetPath = path.join(assetDir, relPath);
      await downloadFile(fileInfo.url, targetPath);
    }

    const label = info?.name ?? asset;
    const category = Array.isArray(info?.categories) && info.categories.length > 0 ? info.categories[0] : "Furniture";
    catalogById.set(asset, {
      id: asset,
      label,
      category,
      assetId: `/assets/models/${asset}/${gltfFileName}`,
      scale: [1, 1, 1],
      description: info?.description ?? "Poly Haven model"
    });
    added += 1;
    console.log(`Model downloaded: ${asset}`);

    if (!dryRun) {
      const catalog = Array.from(catalogById.values());
      await fs.writeFile(catalogPath, JSON.stringify(catalog, null, 2));
    }
  }

  await ensureDir(path.dirname(catalogPath));
  const catalog = Array.from(catalogById.values());
  if (!dryRun) {
    await fs.writeFile(catalogPath, JSON.stringify(catalog, null, 2));
  }
  console.log(`Catalog updated (${catalog.length})`);
}

async function main() {
  await downloadHdri();
  await downloadTextures();
  await downloadModels();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
