/**
 * Turning a picked file into something that can live in a profile row.
 *
 * The photo is never uploaded anywhere as a file. It is decoded, cropped
 * square, scaled down to a thumbnail and re-encoded as a data URL - so it
 * fits in the same text column the nickname lives in, needs no storage
 * bucket, and (because `profiles` is readable only by its owner) is visible
 * to nobody but the person who chose it. That last part is what makes an
 * upload safe to offer at all: there is no gallery for it to appear in and
 * no stranger who can fetch it.
 *
 * SIZE is deliberately small. The avatar renders at 38-56px, so 128 is
 * already retina; going bigger only buys a row too fat to sync and a
 * localStorage quota error on a phone.
 */
const SIZE = 128;
const TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
/** the file as picked, before we shrink it - a guard against a 40MP photo */
const MAX_BYTES = 12 * 1024 * 1024;

export type PhotoError = "type" | "big" | "decode";

export class PhotoProblem extends Error {
  constructor(readonly kind: PhotoError) {
    super(kind);
  }
}

/** Square, centre-cropped, downscaled, and re-encoded. Never returns the
 *  original bytes - a re-encode also drops EXIF, which is where a phone
 *  photo keeps the place it was taken. */
export async function toAvatarDataUrl(file: File): Promise<string> {
  if (!TYPES.includes(file.type)) throw new PhotoProblem("type");
  if (file.size > MAX_BYTES) throw new PhotoProblem("big");

  const bitmap = await load(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new PhotoProblem("decode");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, SIZE, SIZE);
  if ("close" in bitmap) bitmap.close();

  // WebP where it is supported, JPEG where it is not. Both are a third the
  // size of PNG for a photograph, and a photograph is what this is.
  const webp = canvas.toDataURL("image/webp", 0.82);
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", 0.82);
}

async function load(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // Safari has refused some files here; the <img> path below still works
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new PhotoProblem("decode"));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const PHOTO_MESSAGE: Record<PhotoError, string> = {
  type: "사진 파일만 넣을 수 있다. (PNG · JPG · WEBP · GIF)",
  big: "파일이 너무 크다. 12MB 아래로 골라줘.",
  decode: "이 파일은 못 읽었다. 다른 사진으로 해볼래?",
};
