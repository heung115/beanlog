/** Inspect compressed bytes before handing an image to any browser decoder. */
export const MAX_LABEL_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_LABEL_SOURCE_PIXELS = 25_000_000;
const MAX_DIMENSION = 16_384;
const checked = new WeakMap<Blob, { width: number; height: number }>();

function invalid(): never { throw new Error("invalid_image"); }
function dimensions(width: number, height: number) {
  if (!width || !height) invalid();
  if (width > MAX_DIMENSION || height > MAX_DIMENSION || width * height > MAX_LABEL_SOURCE_PIXELS) {
    throw new Error("image_too_large");
  }
  return { width, height };
}

/** Only static PNG, JPEG and WebP are accepted; MIME claims alone are not trusted. */
export function parseLabelImageHeader(bytes: Uint8Array, mime: string) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (offset: number, length: number) => String.fromCharCode(...bytes.subarray(offset, offset + length));
  const has = (offset: number, length: number) => offset >= 0 && offset + length <= bytes.length;
  if (mime === "image/png") {
    if (!has(0, 33) || text(0, 8) !== "\x89PNG\r\n\x1a\n") invalid();
    if (view.getUint32(8) !== 13 || text(12, 4) !== "IHDR") invalid();
    const size = dimensions(view.getUint32(16), view.getUint32(20));
    let dataSeen = false;
    for (let offset = 8; has(offset, 12);) {
      const length = view.getUint32(offset);
      const type = text(offset + 4, 4);
      if (!has(offset, length + 12)) invalid();
      if (type === "acTL" || type === "fcTL" || type === "fdAT" || (type === "IHDR" && offset !== 8)) invalid();
      if (type === "IDAT") dataSeen = true;
      if (type === "IEND") {
        if (length || !dataSeen || offset + 12 !== bytes.length) invalid();
        return size;
      }
      offset += length + 12;
    }
    invalid();
  }
  if (mime === "image/jpeg") {
    if (!has(0, 4) || bytes[0] !== 0xff || bytes[1] !== 0xd8) invalid();
    let size: { width: number; height: number } | undefined;
    let offset = 2;
    while (has(offset, 2)) {
      if (bytes[offset++] !== 0xff) invalid();
      while (bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (marker === 0xda) {
        // A nonzero SOF fixes the decoded dimensions; DNL-dependent images are rejected.
        if (!size || !has(offset, 2)) invalid();
        const length = view.getUint16(offset);
        if (length < 6 || !has(offset, length)) invalid();
        return size;
      }
      if (marker === 0 || marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) invalid();
      if (!has(offset, 2)) invalid();
      const length = view.getUint16(offset);
      if (length < 2 || !has(offset, length)) invalid();
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        if (size || length < 8) invalid();
        size = dimensions(view.getUint16(offset + 5), view.getUint16(offset + 3));
      }
      offset += length;
    }
    invalid();
  }
  if (mime === "image/webp") {
    if (!has(0, 12) || text(0, 4) !== "RIFF" || text(8, 4) !== "WEBP"
      || view.getUint32(4, true) + 8 !== bytes.length) invalid();
    let canvas: { width: number; height: number } | undefined;
    let frame: { width: number; height: number } | undefined;
    const uint24 = (offset: number) => bytes[offset] + bytes[offset + 1] * 256 + bytes[offset + 2] * 65536;
    let offset = 12;
    while (has(offset, 8)) {
      const type = text(offset, 4);
      const length = view.getUint32(offset + 4, true);
      const start = offset + 8;
      if (!has(start, length + (length % 2))) invalid();
      if (type === "ANIM" || type === "ANMF") invalid();
      if (type === "VP8X") {
        if (offset !== 12 || length !== 10 || canvas || (bytes[start] & 2)) invalid();
        canvas = dimensions(1 + uint24(start + 4), 1 + uint24(start + 7));
      } else if (type === "VP8 ") {
        if (frame || length < 10 || (bytes[start] & 1) || text(start + 3, 3) !== "\x9d\x01\x2a") invalid();
        frame = dimensions(view.getUint16(start + 6, true) & 0x3fff, view.getUint16(start + 8, true) & 0x3fff);
      } else if (type === "VP8L") {
        if (frame || length < 5 || bytes[start] !== 0x2f) invalid();
        const bits = view.getUint32(start + 1, true);
        if (bits >>> 29) invalid();
        frame = dimensions((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
      }
      offset = start + length + length % 2;
    }
    if (offset !== bytes.length || !frame || (canvas && (canvas.width !== frame.width || canvas.height !== frame.height))) invalid();
    return frame;
  }
  invalid();
}

export async function validateLabelImageBeforeDecode(image: Blob, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const known = checked.get(image);
  if (known) return known;
  if (!image.size) invalid();
  if (image.size > MAX_LABEL_FILE_BYTES) throw new Error("image_too_large");
  // The byte ceiling bounds this read and all container scans, independently of decoded pixels.
  const bytes = new Uint8Array(await image.arrayBuffer());
  signal?.throwIfAborted();
  const size = parseLabelImageHeader(bytes, image.type);
  checked.set(image, size);
  return size;
}
