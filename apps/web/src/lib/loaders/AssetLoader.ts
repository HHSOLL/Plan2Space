"use client";

import { useEffect } from "react";
import { useLoader } from "@react-three/fiber";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ensureSceneBoundsTrees } from "../performance/mesh-bvh";

const dracoLoader = new DRACOLoader();
const decoderPathRaw =
  process.env.NEXT_PUBLIC_DRACO_DECODER_PATH ??
  "https://www.gstatic.com/draco/v1/decoders/";
const decoderPath = decoderPathRaw.endsWith("/") ? decoderPathRaw : `${decoderPathRaw}/`;
const workerLimit =
  typeof navigator !== "undefined" && navigator.hardwareConcurrency
    ? Math.min(4, Math.max(2, Math.floor(navigator.hardwareConcurrency / 2)))
    : 2;
dracoLoader.setDecoderPath(decoderPath);
dracoLoader.setWorkerLimit(workerLimit);
dracoLoader.preload();

export function useGLBAsset(path: string): GLTF {
  const gltf = useLoader(GLTFLoader, path, (loader) => {
    loader.setDRACOLoader(dracoLoader);
    loader.setMeshoptDecoder(MeshoptDecoder);
  });

  useEffect(() => {
    ensureSceneBoundsTrees(gltf.scene);
  }, [gltf]);

  return gltf;
}
