import sharp from "sharp";
import fs from "fs";

interface CompressionResult {
  originalSize: number;
  compressedSize: number;
  outputPath: string;
}

export async function compressImage(
  inputPath: string,
  outputPath: string
): Promise<CompressionResult> {
  const originalSize = fs.statSync(inputPath).size;

  await sharp(inputPath)
    .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 70 })
    .toFile(outputPath);

  const compressedSize = fs.statSync(outputPath).size;

  return { originalSize, compressedSize, outputPath };
}

export function isImage(mimeType: string): boolean {
  return ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"].includes(mimeType);
}
