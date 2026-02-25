"use server";

import crypto from "crypto";
import sharp from "sharp";

export type ImageHashResult = {
  hash: string;
  sha256: string;
  width: number;
  height: number;
};

const HASH_WIDTH = 9;
const HASH_HEIGHT = 8;

export async function computeImageHash(base64: string): Promise<ImageHashResult> {
  const buffer = Buffer.from(base64, "base64");
  const metadata = await sharp(buffer).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  const pixels = await sharp(buffer)
    .resize(HASH_WIDTH, HASH_HEIGHT, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer();

  let hash = 0n;
  for (let y = 0; y < HASH_HEIGHT; y += 1) {
    for (let x = 0; x < HASH_WIDTH - 1; x += 1) {
      const left = pixels[y * HASH_WIDTH + x] ?? 0;
      const right = pixels[y * HASH_WIDTH + x + 1] ?? 0;
      hash = (hash << 1n) | (left > right ? 1n : 0n);
    }
  }

  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  return {
    hash: hash.toString(16).padStart(16, "0"),
    sha256,
    width,
    height
  };
}

export async function hammingDistanceHex(a: string, b: string): Promise<number> {
  const aInt = BigInt(`0x${a}`);
  const bInt = BigInt(`0x${b}`);
  let value = aInt ^ bInt;
  let count = 0;
  while (value > 0n) {
    count += Number(value & 1n);
    value >>= 1n;
  }
  return count;
}
