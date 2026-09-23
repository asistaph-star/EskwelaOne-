declare global {
  interface Window {
    cv: any;
  }
}

export type ScannerFilter = "Original" | "Auto" | "Color" | "Grayscale" | "B&W" | "Enhanced";

export interface Point {
  x: number;
  y: number;
}

export interface Quad {
  tl: Point;
  tr: Point;
  br: Point;
  bl: Point;
}

// --------------------------------------------------------------------------------
// 1. DETECTION
// --------------------------------------------------------------------------------

/**
 * Attempts to detect the 4 corners of a document in an image.
 * Returns null if no valid document is found.
 */
export function detectDocumentCorners(imageData: ImageData): Quad | null {
  const cv = window.cv;
  if (!cv) {
    console.error("OpenCV not loaded");
    return null;
  }

  // Create Mat from imageData
  const src = cv.matFromImageData(imageData);
  const gray = new cv.Mat();
  const blurred = new cv.Mat();
  const edges = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();

  try {
    // 1. Grayscale
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

    // 2. Blur to reduce noise
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);

    // 3. Edge detection
    cv.Canny(blurred, edges, 75, 200, 3, false);

    // 4. Find contours
    cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    // 5. Find the largest contour with 4 points
    let maxArea = 0;
    let bestQuad: any = null; // cv.Mat of 4 points

    for (let i = 0; i < contours.size(); i++) {
      const cnt = contours.get(i);
      const area = cv.contourArea(cnt);
      
      // Ignore tiny artifacts
      if (area < 5000) continue; 

      const peri = cv.arcLength(cnt, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(cnt, approx, 0.02 * peri, true);

      if (approx.rows === 4 && area > maxArea) {
        maxArea = area;
        if (bestQuad) bestQuad.delete();
        bestQuad = approx.clone();
      }
      approx.delete();
      cnt.delete();
    }

    if (!bestQuad) return null;

    // 6. Extract the 4 points
    const points = [];
    for (let i = 0; i < 4; i++) {
      points.push({
        x: bestQuad.data32S[i * 2],
        y: bestQuad.data32S[i * 2 + 1]
      });
    }
    bestQuad.delete();

    // 7. Order the points: tl, tr, br, bl
    const ordered = orderPoints(points);
    return ordered;

  } catch (e) {
    console.error("Error in detectDocumentCorners:", e);
    return null;
  } finally {
    src.delete();
    gray.delete();
    blurred.delete();
    edges.delete();
    contours.delete();
    hierarchy.delete();
  }
}

// --------------------------------------------------------------------------------
// 2. PERSPECTIVE CORRECTION
// --------------------------------------------------------------------------------

/**
 * Warps the perspective of the image based on the given 4 corners,
 * returning a new top-down flat image data.
 */
export function correctPerspective(imageData: ImageData, quad: Quad): ImageData | null {
  const cv = window.cv;
  if (!cv) return null;

  const src = cv.matFromImageData(imageData);

  // Compute width/height of new image based on distances
  const widthA = Math.hypot(quad.br.x - quad.bl.x, quad.br.y - quad.bl.y);
  const widthB = Math.hypot(quad.tr.x - quad.tl.x, quad.tr.y - quad.tl.y);
  const maxWidth = Math.max(widthA, widthB);

  const heightA = Math.hypot(quad.tr.x - quad.br.x, quad.tr.y - quad.br.y);
  const heightB = Math.hypot(quad.tl.x - quad.bl.x, quad.tl.y - quad.bl.y);
  const maxHeight = Math.max(heightA, heightB);

  const finalW = Math.round(maxWidth);
  const finalH = Math.round(maxHeight);

  if (finalW <= 0 || finalH <= 0) {
    src.delete();
    return null;
  }

  const dst = new cv.Mat();
  const dsize = new cv.Size(finalW, finalH);

  // Source coordinates
  const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
    quad.tl.x, quad.tl.y,
    quad.tr.x, quad.tr.y,
    quad.br.x, quad.br.y,
    quad.bl.x, quad.bl.y
  ]);

  // Destination coordinates
  const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
    0, 0,
    finalW - 1, 0,
    finalW - 1, finalH - 1,
    0, finalH - 1
  ]);

  const M = cv.getPerspectiveTransform(srcTri, dstTri);

  try {
    cv.warpPerspective(src, dst, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());
    
    // Create new ImageData
    const imgData = new ImageData(new Uint8ClampedArray(dst.data), dst.cols, dst.rows);
    return imgData;
  } catch (e) {
    console.error("Error in correctPerspective:", e);
    return null;
  } finally {
    src.delete();
    dst.delete();
    srcTri.delete();
    dstTri.delete();
    M.delete();
  }
}

// --------------------------------------------------------------------------------
// 3. ENHANCEMENT FILTERS
// --------------------------------------------------------------------------------

/**
 * Applies a specific document filter to the image data.
 * The input should already be cropped/perspective-corrected.
 */
export function applyScannerFilter(imageData: ImageData, filter: ScannerFilter): ImageData | null {
  const cv = window.cv;
  if (!cv) return null;

  if (filter === "Original") return imageData;

  const src = cv.matFromImageData(imageData);
  const dst = new cv.Mat();

  try {
    if (filter === "Auto") {
      // Auto: Enhance contrast but keep color
      // Convert to LAB, equalize L channel, convert back
      const lab = new cv.Mat();
      cv.cvtColor(src, lab, cv.COLOR_RGBA2RGB); // Drop alpha first
      cv.cvtColor(lab, lab, cv.COLOR_RGB2Lab);
      
      const channels = new cv.MatVector();
      cv.split(lab, channels);
      const l = channels.get(0);
      
      // Use CLAHE for better local contrast without blowing out whites
      const clahe = new cv.CLAHE(2.0, new cv.Size(8, 8));
      clahe.apply(l, l);
      
      cv.merge(channels, lab);
      cv.cvtColor(lab, dst, cv.COLOR_Lab2RGB);
      cv.cvtColor(dst, dst, cv.COLOR_RGB2RGBA);

      lab.delete(); channels.delete(); l.delete(); clahe.delete();

    } else if (filter === "Color") {
      // Color: Brighten slightly, apply bilateral filter for noise
      const tmp = new cv.Mat();
      cv.cvtColor(src, tmp, cv.COLOR_RGBA2RGB);
      
      // Increase brightness & contrast using convertTo (alpha, beta)
      tmp.convertTo(tmp, -1, 1.2, 10);
      
      // Bilateral filter keeps edges sharp while smoothing noise
      // Note: bilateralFilter can be slow on large images, so we use a small kernel
      cv.bilateralFilter(tmp, dst, 5, 50, 50);
      
      cv.cvtColor(dst, dst, cv.COLOR_RGB2RGBA);
      tmp.delete();

    } else if (filter === "Grayscale") {
      cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY);
      cv.cvtColor(dst, dst, cv.COLOR_GRAY2RGBA); // Convert back for ImageData format

    } else if (filter === "B&W") {
      // Black & White (Text optimize): Adaptive Thresholding
      const gray = new cv.Mat();
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      
      // Gaussian blur to remove tiny speckles before thresholding
      cv.GaussianBlur(gray, gray, new cv.Size(3, 3), 0, 0, cv.BORDER_DEFAULT);
      
      // Adaptive Threshold handles shadows well
      cv.adaptiveThreshold(gray, dst, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 21, 10);
      
      cv.cvtColor(dst, dst, cv.COLOR_GRAY2RGBA);
      gray.delete();

    } else if (filter === "Enhanced") {
      // Enhanced: Sharpening mask + strong contrast
      const gray = new cv.Mat();
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      
      // Unsharp mask
      const blur = new cv.Mat();
      cv.GaussianBlur(gray, blur, new cv.Size(0, 0), 3);
      cv.addWeighted(gray, 1.5, blur, -0.5, 0, dst);
      
      // Global threshold to punch the blacks
      cv.threshold(dst, dst, 150, 255, cv.THRESH_BINARY | cv.THRESH_OTSU);

      cv.cvtColor(dst, dst, cv.COLOR_GRAY2RGBA);
      gray.delete(); blur.delete();
    }

    const imgData = new ImageData(new Uint8ClampedArray(dst.data), dst.cols, dst.rows);
    return imgData;

  } catch (e) {
    console.error("Error in applyScannerFilter:", e);
    return null;
  } finally {
    src.delete();
    dst.delete();
  }
}

// --------------------------------------------------------------------------------
// UTILS
// --------------------------------------------------------------------------------

/**
 * Orders points: top-left, top-right, bottom-right, bottom-left
 */
function orderPoints(pts: Point[]): Quad {
  // Sort by x
  const xSorted = [...pts].sort((a, b) => a.x - b.x);
  
  // Leftmost points
  const leftMost = [xSorted[0], xSorted[1]];
  // Rightmost points
  const rightMost = [xSorted[2], xSorted[3]];

  // Sort leftmost by y: tl is top (smallest y), bl is bottom (largest y)
  leftMost.sort((a, b) => a.y - b.y);
  const tl = leftMost[0];
  const bl = leftMost[1];

  // Sort rightmost by y: tr is top (smallest y), br is bottom (largest y)
  rightMost.sort((a, b) => a.y - b.y);
  const tr = rightMost[0];
  const br = rightMost[1];

  return { tl, tr, br, bl };
}

/**
 * Converts ImageData to a base64 DataURL using a hidden canvas.
 */
export function imageDataToDataURL(imageData: ImageData, format = "image/jpeg", quality = 0.8): string {
  const canvas = document.createElement("canvas");
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL(format, quality);
}

/**
 * Loads an image from a Data URL (or file object converted to Data URL) into an HTMLImageElement
 */
export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

/**
 * Extracts ImageData from an HTMLImageElement.
 * Can optionally downscale it to a max dimension to save memory.
 */
export function extractImageData(img: HTMLImageElement, maxDim = 1500): ImageData | null {
  const canvas = document.createElement("canvas");
  let w = img.width;
  let h = img.height;

  if (w > maxDim || h > maxDim) {
    const ratio = Math.min(maxDim / w, maxDim / h);
    w = Math.round(w * ratio);
    h = Math.round(h * ratio);
  }

  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  
  ctx.drawImage(img, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}
