export type Photo = {
  base64: string;
  mime: "image/jpeg";
  previewUrl: string;
  width: number;
  height: number;
};

const MAX_SIDE = 1600;

/** Resizes a chosen file in the browser and returns it as a JPEG. */
export async function preparePhoto(file: File): Promise<Photo> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("That photo could not be opened. Try a JPG or PNG."));
      el.src = url;
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.round(img.naturalWidth * scale);
    const height = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Your browser could not process this photo.");
    ctx.drawImage(img, 0, 0, width, height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
    return { base64: dataUrl.split(",")[1] ?? "", mime: "image/jpeg", previewUrl: dataUrl, width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}
