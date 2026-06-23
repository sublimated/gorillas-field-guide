// Turn a user-supplied image file into a glyph `src` (data URL).
// Raster (PNG/WebP/JPG) is downscaled to keep alpha and keep localStorage small; SVG is
// kept as vector (passed through as a data URL). Rendered via <image>, so it's safe and
// the artwork shows exactly as authored.

const MAX_EDGE = 256; // px — plenty for a glyph; keeps stored data URLs small

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function fileToGlyphSrc(file: File): Promise<string> {
  const isSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
  if (isSvg) {
    const text = await file.text();
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(text);
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/png'); // PNG preserves the alpha channel
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
