const MAX_EDGE = 1600;
const QUALITY = 0.82;
const MAX_BYTES = 2.5 * 1024 * 1024;

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("이미지를 불러오지 못했습니다."));
    };
    img.src = url;
  });
}

/** Compress / resize to JPEG under MAX_EDGE; strips EXIF via canvas redraw. */
export async function compressAttendancePhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) {
    throw new Error("이미지 파일만 업로드할 수 있습니다.");
  }
  if (file.size > 15 * 1024 * 1024) {
    throw new Error("이미지 용량이 너무 큽니다. (최대 15MB)");
  }

  const img = await loadImage(file);
  let { width, height } = img;
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  width = Math.round(width * scale);
  height = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("이미지 처리를 지원하지 않는 환경입니다.");
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", QUALITY),
  );
  if (!blob) throw new Error("이미지 압축에 실패했습니다.");
  if (blob.size > MAX_BYTES) {
    throw new Error("압축 후에도 용량이 큽니다. 다른 사진으로 다시 시도하세요.");
  }
  return blob;
}
