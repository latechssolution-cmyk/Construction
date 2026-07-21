// Client-side pre-processing for Cloudinary uploads.
//
// The free Cloudinary plan rejects individual files over 10 MB (raw files
// and images alike), well below the 50 MB the signed token allows. Images
// can be transparently re-encoded in the browser to fit; PDFs and Office
// documents cannot be meaningfully compressed client-side, so those get a
// clear upfront error instead of a confusing failure after the upload runs.
//
// If the Cloudinary plan is upgraded, raise PLAN_FILE_LIMIT here and the
// whole app follows.
export const PLAN_FILE_LIMIT = 10 * 1024 * 1024;

const JPEG_QUALITIES = [0.85, 0.75, 0.6, 0.5, 0.4];

export async function prepareFileForUpload(original: File): Promise<{ file: File; note?: string; error?: string }> {
  if (original.size <= PLAN_FILE_LIMIT) return { file: original };

  if (!original.type.startsWith("image/")) {
    return {
      file: original,
      error: `${original.name} is ${(original.size / 1024 / 1024).toFixed(1)} MB — documents over ${Math.round(PLAN_FILE_LIMIT / 1024 / 1024)} MB can't be compressed in the browser. Compress the PDF first with the free PDF24 app (pdf24.org) and upload the smaller copy.`,
    };
  }

  try {
    const bitmap = await createImageBitmap(original);
    // Start near full size and shrink dimensions between quality passes.
    let scale = Math.min(1, 3000 / Math.max(bitmap.width, bitmap.height));
    for (const quality of JPEG_QUALITIES) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) break;
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= PLAN_FILE_LIMIT) {
        const name = original.name.replace(/\.[^.]+$/, "") + ".jpg";
        return {
          file: new File([blob], name, { type: "image/jpeg" }),
          note: `Image compressed from ${(original.size / 1024 / 1024).toFixed(1)} MB to ${(blob.size / 1024 / 1024).toFixed(1)} MB`,
        };
      }
      scale *= 0.75;
    }
  } catch {
    // createImageBitmap can fail on exotic formats — fall through to error.
  }

  return {
    file: original,
    error: `Could not compress ${original.name} under ${Math.round(PLAN_FILE_LIMIT / 1024 / 1024)} MB — try a smaller image.`,
  };
}
