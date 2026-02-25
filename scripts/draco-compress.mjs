#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import { NodeIO } from "@gltf-transform/core";
import { KHRDracoMeshCompression, KHRTextureTransform } from "@gltf-transform/extensions";
import { draco } from "@gltf-transform/functions";
import draco3d from "draco3dgltf";

const args = process.argv.slice(2);

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

const destRoot = getArg("dest", "apps/web/public/assets/models");
const limit = Number(getArg("limit", "0"));
const dryRun = hasFlag("dry-run");
const compressionLevel = Number(getArg("level", "6"));

async function listGltfFiles(rootDir) {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      const inner = await fs.readdir(fullPath, { withFileTypes: true });
      for (const innerEntry of inner) {
        if (innerEntry.isFile() && innerEntry.name.endsWith(".gltf")) {
          files.push(path.join(fullPath, innerEntry.name));
        }
      }
    }
  }
  return files;
}

async function main() {
  const files = await listGltfFiles(destRoot);
  const targetFiles = limit > 0 ? files.slice(0, limit) : files;

  if (targetFiles.length === 0) {
    console.log("No .gltf files found for Draco compression.");
    return;
  }

  const decoderModule = await draco3d.createDecoderModule();
  const encoderModule = await draco3d.createEncoderModule();

  const io = new NodeIO()
    .registerExtensions([KHRDracoMeshCompression, KHRTextureTransform])
    .registerDependencies({
      "draco3d.decoder": decoderModule,
      "draco3d.encoder": encoderModule
    });

  let processed = 0;

  for (const filePath of targetFiles) {
    if (dryRun) {
      console.log(`[dry-run] Draco compress ${filePath}`);
      continue;
    }
    try {
      const doc = await io.read(filePath);
      await doc.transform(draco({ compressionLevel }));
      await io.write(filePath, doc);
      processed += 1;
      console.log(`Compressed: ${filePath}`);
    } catch (error) {
      console.warn(`Failed to compress ${filePath}:`, error instanceof Error ? error.message : error);
    }
  }

  console.log(`Draco compression complete (${processed}/${targetFiles.length}).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
