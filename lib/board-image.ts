const MAX_EDGE = 1920;
const JPEG_QUALITY = 0.85;
const DEFAULT_MAX_W = 480;
const DEFAULT_MAX_H = 360;

export type ProcessedImage = {
  blob: Blob;
  naturalW: number;
  naturalH: number;
};

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("이미지를 읽을 수 없어요."));
    };
    img.src = url;
  });
}

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("이미지를 읽을 수 없어요."));
    };
    img.src = url;
  });
}

async function rasterizeToJpeg(img: HTMLImageElement): Promise<ProcessedImage> {
  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;
  if (w < 1 || h < 1) {
    throw new Error("이미지 크기가 올바르지 않아요.");
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
  w = Math.max(1, Math.round(w * scale));
  h = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("이미지를 처리할 수 없어요.");
  ctx.drawImage(img, 0, 0, w, h);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("이미지 압축에 실패했어요."))),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });

  return { blob, naturalW: w, naturalH: h };
}

export async function fileToImageBlob(file: File): Promise<ProcessedImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error("이미지 파일만 넣을 수 있어요.");
  }
  const img = await loadImageFromFile(file);
  return rasterizeToJpeg(img);
}

export async function blobToImageBlob(blob: Blob): Promise<ProcessedImage> {
  const img = await loadImageFromBlob(blob);
  return rasterizeToJpeg(img);
}

export function clipboardItemToBlob(
  clipboard: DataTransfer | null,
): Blob | null {
  if (!clipboard?.items?.length) return null;
  for (const item of clipboard.items) {
    if (item.type.startsWith("image/")) {
      const blob = item.getAsFile();
      if (blob) return blob;
    }
  }
  return null;
}

export function defaultPlacementSize(
  naturalW: number,
  naturalH: number,
  viewport?: { w: number; h: number },
): { w: number; h: number } {
  const vw = viewport?.w ?? (typeof window !== "undefined" ? window.innerWidth : 800);
  const vh = viewport?.h ?? (typeof window !== "undefined" ? window.innerHeight : 600);
  const maxW = Math.min(DEFAULT_MAX_W, vw * 0.55);
  const maxH = Math.min(DEFAULT_MAX_H, vh * 0.45);
  const scale = Math.min(maxW / naturalW, maxH / naturalH, 1);
  return {
    w: Math.max(80, Math.round(naturalW * scale)),
    h: Math.max(60, Math.round(naturalH * scale)),
  };
}

export function clampPlacement(
  x: number,
  y: number,
  w: number,
  h: number,
): { x: number; y: number } {
  const vw = typeof window !== "undefined" ? window.innerWidth : 800;
  const vh = typeof window !== "undefined" ? window.innerHeight : 600;
  return {
    x: Math.min(Math.max(x, 8), Math.max(8, vw - w - 8)),
    y: Math.min(Math.max(y, 8), Math.max(8, vh - h - 8)),
  };
}
