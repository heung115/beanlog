export type LabelTextRegion = { x: number; y: number; width: number; height: number };

type PixelImage = { width: number; height: number; data: Uint8ClampedArray };
type Component = { left: number; top: number; right: number; bottom: number; area: number };
type TextBand = Component & { count: number; medianHeight: number; support: number };

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function envelope(components: Component[]): Component {
  const bounds = { left: Infinity, top: Infinity, right: 0, bottom: 0, area: 0 };
  for (const component of components) {
    bounds.left = Math.min(bounds.left, component.left);
    bounds.top = Math.min(bounds.top, component.top);
    bounds.right = Math.max(bounds.right, component.right);
    bounds.bottom = Math.max(bounds.bottom, component.bottom);
    bounds.area += component.area;
  }
  return bounds;
}

/** Finds a compact text block in an already downsampled photograph, without OCR. */
export function detectLabelTextRegion({ width, height, data }: PixelImage): LabelTextRegion | null {
  const pixels = width * height;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 64 || height < 64
    || pixels > 4_000_000 || data.length !== pixels * 4) return null;

  const scale = Math.min(width, height) / 768;
  const radius = Math.max(2, Math.round(8 * scale));
  const gray = new Uint8Array(pixels);
  const stride = width + 1;
  const integral = new Float64Array(stride * (height + 1));
  for (let y = 0; y < height; y += 1) {
    let rowSum = 0;
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      const offset = pixel * 4;
      const alpha = data[offset + 3] / 255;
      gray[pixel] = Math.round((data[offset] * 0.299 + data[offset + 1] * 0.587
        + data[offset + 2] * 0.114) * alpha + 255 * (1 - alpha));
      rowSum += gray[pixel];
      integral[(y + 1) * stride + x + 1] = integral[y * stride + x + 1] + rowSum;
    }
  }

  // Local background subtraction retains dim ink while rejecting gradual shadows.
  const mask = new Uint8Array(pixels);
  for (let y = 0; y < height; y += 1) {
    const top = Math.max(0, y - radius);
    const bottom = Math.min(height, y + radius + 1);
    for (let x = 0; x < width; x += 1) {
      const left = Math.max(0, x - radius);
      const right = Math.min(width, x + radius + 1);
      const sum = integral[bottom * stride + right] - integral[top * stride + right]
        - integral[bottom * stride + left] + integral[top * stride + left];
      mask[y * width + x] = sum / ((right - left) * (bottom - top)) - gray[y * width + x] > 12 ? 1 : 0;
    }
  }

  const queue = new Int32Array(pixels);
  const components: Component[] = [];
  for (let start = 0; start < pixels; start += 1) {
    if (!mask[start]) continue;
    let head = 0;
    let tail = 1;
    queue[0] = start;
    mask[start] = 0;
    let left = start % width;
    let right = left + 1;
    let top = Math.floor(start / width);
    let bottom = top + 1;
    while (head < tail) {
      const pixel = queue[head++];
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      left = Math.min(left, x);
      right = Math.max(right, x + 1);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y + 1);
      for (let ny = Math.max(0, y - 1); ny <= Math.min(height - 1, y + 1); ny += 1) {
        for (let nx = Math.max(0, x - 1); nx <= Math.min(width - 1, x + 1); nx += 1) {
          const neighbor = ny * width + nx;
          if (mask[neighbor]) {
            mask[neighbor] = 0;
            queue[tail++] = neighbor;
          }
        }
      }
    }
    const componentWidth = right - left;
    const componentHeight = bottom - top;
    const fill = tail / (componentWidth * componentHeight);
    if (componentHeight >= Math.max(3, 4 * scale) && componentHeight <= 40 * scale
      && componentWidth <= 50 * scale && tail >= Math.max(3, 3 * scale * scale)
      && componentWidth / componentHeight >= 0.05 && componentWidth / componentHeight <= 5
      && fill >= 0.08 && fill <= 0.93) {
      components.push({ left, top, right, bottom, area: tail });
    }
  }
  if (components.length < 24) return null;

  const projection = new Float64Array(height);
  for (const component of components) {
    for (let y = component.top; y < component.bottom; y += 1) {
      projection[y] += component.right - component.left;
    }
  }
  const smoothingRadius = Math.max(1, Math.round(3 * scale));
  const activeRows: { top: number; bottom: number; peak: number }[] = [];
  for (let y = 0; y < height; y += 1) {
    const top = Math.max(0, y - smoothingRadius);
    const bottom = Math.min(height, y + smoothingRadius + 1);
    let sum = 0;
    for (let row = top; row < bottom; row += 1) sum += projection[row];
    const support = sum / (bottom - top);
    if (support < width * 0.06) continue;
    const previous = activeRows.at(-1);
    if (previous && y - previous.bottom <= Math.max(2, 5 * scale)) {
      previous.bottom = y;
      previous.peak = Math.max(previous.peak, support);
    } else activeRows.push({ top: y, bottom: y, peak: support });
  }

  const bands: TextBand[] = [];
  for (const rows of activeRows) {
    const members = components.filter((component) => {
      const center = (component.top + component.bottom) / 2;
      return center >= rows.top && center <= rows.bottom;
    });
    if (members.length < 8) continue;
    const bounds = envelope(members);
    const medianHeight = median(members.map((component) => component.bottom - component.top));
    const support = rows.peak / (bounds.right - bounds.left);
    // Repeated small shapes in clothing and package borders seldom form dense, short rows.
    if (medianHeight < Math.max(3, 6 * scale) || bounds.bottom - bounds.top > medianHeight * 5
      || support < 0.35) continue;
    bands.push({ ...bounds, count: members.length, medianHeight, support });
  }

  const groups: TextBand[][] = [];
  for (const band of bands) {
    const group = groups.find((candidate) => {
      const previous = candidate.at(-1)!;
      const gap = band.top - previous.bottom;
      const overlap = Math.max(0, Math.min(band.right, previous.right) - Math.max(band.left, previous.left));
      return gap >= 0 && gap <= 2.5 * Math.max(band.medianHeight, previous.medianHeight)
        && overlap >= 0.6 * Math.min(band.right - band.left, previous.right - previous.left);
    });
    if (group) group.push(band);
    else groups.push([band]);
  }
  const ranked = groups.map((bands) => ({
    bands,
    bounds: envelope(bands),
    score: bands.reduce((sum, band) => sum + band.count * Math.min(1, band.support), 0) * Math.min(3, bands.length),
  })).sort((a, b) => b.score - a.score);
  const best = ranked[0];
  if (!best || best.bands.length < 2 || best.score < 0.65 * ranked.reduce((sum, group) => sum + group.score, 0)) return null;

  const bounds = best.bounds;
  const blockWidth = bounds.right - bounds.left;
  const blockHeight = bounds.bottom - bounds.top;
  // Roomy text-only labels can leave substantial blank space; keep them on the full-image path.
  if (blockWidth < width * 0.22 || blockHeight > height * 0.4 || blockWidth * blockHeight > pixels * 0.4) return null;
  const medianHeight = median(best.bands.map((band) => band.medianHeight));
  const padding = Math.max(4, Math.min(16, Math.ceil(0.6 * medianHeight)));
  const x = Math.max(0, bounds.left - padding);
  const y = Math.max(0, bounds.top - padding);
  const right = Math.min(width, bounds.right + padding);
  const bottom = Math.min(height, bounds.bottom + padding);
  if ((right - x) * (bottom - y) > pixels * 0.5) return null;
  return { x, y, width: right - x, height: bottom - y };
}
