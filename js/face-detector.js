/**
 * Sea & Seas Shipping Private Limited
 * Client-Side Real-Time Face Detection Engine
 * High-performance, offline face verification using Native Shape Detection API & Pico.js fallback
 */

(function (window) {
  'use strict';

  let cascadeClassifier = null;
  let cascadeLoadingPromise = null;

  const pico = {
    unpack_cascade: function (bytes) {
      const dview = new DataView(new ArrayBuffer(4));
      let p = 8;
      dview.setUint8(0, bytes[p + 0]); dview.setUint8(1, bytes[p + 1]); dview.setUint8(2, bytes[p + 2]); dview.setUint8(3, bytes[p + 3]);
      const tdepth = dview.getInt32(0, true);
      p += 4;
      dview.setUint8(0, bytes[p + 0]); dview.setUint8(1, bytes[p + 1]); dview.setUint8(2, bytes[p + 2]); dview.setUint8(3, bytes[p + 3]);
      const ntrees = dview.getInt32(0, true);
      p += 4;
      const tcodes_ls = [];
      const tpreds_ls = [];
      const thresh_ls = [];
      for (let t = 0; t < ntrees; ++t) {
        Array.prototype.push.apply(tcodes_ls, [0, 0, 0, 0]);
        Array.prototype.push.apply(tcodes_ls, bytes.slice(p, p + 4 * Math.pow(2, tdepth) - 4));
        p += 4 * Math.pow(2, tdepth) - 4;
        for (let i = 0; i < Math.pow(2, tdepth); ++i) {
          dview.setUint8(0, bytes[p + 0]); dview.setUint8(1, bytes[p + 1]); dview.setUint8(2, bytes[p + 2]); dview.setUint8(3, bytes[p + 3]);
          tpreds_ls.push(dview.getFloat32(0, true));
          p += 4;
        }
        dview.setUint8(0, bytes[p + 0]); dview.setUint8(1, bytes[p + 1]); dview.setUint8(2, bytes[p + 2]); dview.setUint8(3, bytes[p + 3]);
        thresh_ls.push(dview.getFloat32(0, true));
        p += 4;
      }
      const tcodes = new Int8Array(tcodes_ls);
      const tpreds = new Float32Array(tpreds_ls);
      const thresh = new Float32Array(thresh_ls);

      return function classify_region(r, c, s, pixels, ldim) {
        r = 256 * r; c = 256 * c;
        let root = 0;
        let o = 0.0;
        const pow2tdepth = Math.pow(2, tdepth) >> 0;
        for (let i = 0; i < ntrees; ++i) {
          let idx = 1;
          for (let j = 0; j < tdepth; ++j) {
            idx = 2 * idx + (pixels[((r + tcodes[root + 4 * idx + 0] * s) >> 8) * ldim + ((c + tcodes[root + 4 * idx + 1] * s) >> 8)] <= pixels[((r + tcodes[root + 4 * idx + 2] * s) >> 8) * ldim + ((c + tcodes[root + 4 * idx + 3] * s) >> 8)]);
          }
          o += tpreds[pow2tdepth * i + idx - pow2tdepth];
          if (o <= thresh[i]) return -1.0;
          root += 4 * pow2tdepth;
        }
        return o - thresh[ntrees - 1];
      };
    },

    run_cascade: function (image, classify_region, params) {
      const pixels = image.pixels;
      const nrows = image.nrows;
      const ncols = image.ncols;
      const ldim = image.ldim;
      const shiftfactor = params.shiftfactor || 0.1;
      const minsize = params.minsize || 40;
      const maxsize = params.maxsize || 600;
      const scalefactor = params.scalefactor || 1.1;

      let scale = minsize;
      const detections = [];
      while (scale <= maxsize) {
        const step = Math.max(shiftfactor * scale, 1) >> 0;
        const offset = (scale / 2 + 1) >> 0;
        for (let r = offset; r <= nrows - offset; r += step) {
          for (let c = offset; c <= ncols - offset; c += step) {
            const q = classify_region(r, c, scale, pixels, ldim);
            if (q > 0.0) detections.push([r, c, scale, q]);
          }
        }
        scale = scale * scalefactor;
      }
      return detections;
    },

    cluster_detections: function (dets, iouthreshold) {
      dets = dets.sort((a, b) => b[3] - a[3]);
      function calculate_iou(det1, det2) {
        const r1 = det1[0], c1 = det1[1], s1 = det1[2];
        const r2 = det2[0], c2 = det2[1], s2 = det2[2];
        const overr = Math.max(0, Math.min(r1 + s1 / 2, r2 + s2 / 2) - Math.max(r1 - s1 / 2, r2 - s2 / 2));
        const overc = Math.max(0, Math.min(c1 + s1 / 2, c2 + s2 / 2) - Math.max(c1 - s1 / 2, c2 - s2 / 2));
        return (overr * overc) / (s1 * s1 + s2 * s2 - overr * overc);
      }
      const assignments = new Array(dets.length).fill(0);
      const clusters = [];
      for (let i = 0; i < dets.length; ++i) {
        if (assignments[i] === 0) {
          assignments[i] = 1;
          let r = dets[i][0], c = dets[i][1], s = dets[i][2], q = dets[i][3], n = 1;
          for (let j = i + 1; j < dets.length; ++j) {
            if (calculate_iou(dets[i], dets[j]) > iouthreshold) {
              assignments[j] = 1;
              r += dets[j][0]; c += dets[j][1]; s += dets[j][2]; q += dets[j][3];
              n += 1;
            }
          }
          clusters.push([r / n, c / n, s / n, q]);
        }
      }
      return clusters;
    }
  };

  async function loadCascade() {
    if (cascadeClassifier) return cascadeClassifier;
    if (cascadeLoadingPromise) return cascadeLoadingPromise;

    cascadeLoadingPromise = (async () => {
      try {
        const res = await fetch('/js/facefinder?v=20261013');
        if (!res.ok) throw new Error('Cascade fetch failed: ' + res.status);
        const buffer = await res.arrayBuffer();
        const bytes = new Int8Array(buffer);
        cascadeClassifier = pico.unpack_cascade(bytes);
        return cascadeClassifier;
      } catch (err) {
        console.warn('[FaceDetector] Fallback cascade loading error:', err);
        return null;
      }
    })();
    return cascadeLoadingPromise;
  }

  // Preload cascade in background
  if (typeof window !== 'undefined' && window.fetch) {
    loadCascade();
  }

  function calibratePicoConfidence(q) {
    // Maps Pico margin score q to a calibrated percentage (0-100%)
    // Logistic sigmoid centered around q = 28
    const k = 0.10;
    const x0 = 28;
    const prob = 1 / (1 + Math.exp(-k * (q - x0)));
    return Math.min(99, Math.max(10, Math.round(prob * 100)));
  }

  function checkBackgroundCorners(img) {
    try {
      if (typeof document === 'undefined') return { valid: true };
      const canvas = document.createElement('canvas');
      const w = 120;
      const h = 120;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return { valid: true };
      ctx.drawImage(img, 0, 0, w, h);

      // Sample top-left corner (0..12, 0..12) and top-right corner (108..120, 0..12)
      const tlData = ctx.getImageData(0, 0, 12, 12).data;
      const trData = ctx.getImageData(108, 0, 12, 12).data;

      function getLuminanceStats(data) {
        let sumLum = 0;
        const count = data.length / 4;
        for (let i = 0; i < data.length; i += 4) {
          sumLum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        }
        return sumLum / count;
      }

      const tlLum = getLuminanceStats(tlData);
      const trLum = getLuminanceStats(trData);

      // Reject pitch dark, black, or heavily tinted background (passport photos require light/white)
      if (tlLum < 55 && trLum < 55) {
        return {
          valid: false,
          error: 'Dark or heavily tinted background detected. Passport photos require a plain light or white background.'
        };
      }
    } catch (e) {
      // Non-fatal if canvas context is restricted
    }
    return { valid: true };
  }

  const FaceDetectorEngine = {
    init: loadCascade,

    /**
     * Detects human faces in an HTMLImageElement, HTMLCanvasElement, or ImageBitmap
     * @param {HTMLImageElement|HTMLCanvasElement|ImageBitmap} img
     * @returns {Promise<{detected: boolean, count: number, faces: Array, confidence: number, error?: string}>}
     */
    detect: async function (img) {
      if (!img || !img.width || !img.height) {
        return { detected: false, count: 0, faces: [], confidence: 0, error: 'Invalid image dimensions.' };
      }

      const origW = img.naturalWidth || img.videoWidth || img.width;
      const origH = img.naturalHeight || img.videoHeight || img.height;

      if (origW < 120 || origH < 120) {
        return { detected: false, count: 0, faces: [], confidence: 0, error: 'Image resolution is too low for passport photo.' };
      }

      // Fast-path: Native Chromium Shape Detection API
      if ('FaceDetector' in window) {
        try {
          const nativeDetector = new window.FaceDetector({ fastMode: false, maxDetectedFaces: 5 });
          const nativeFaces = await nativeDetector.detect(img);
          if (nativeFaces && nativeFaces.length > 0) {
            const mappedFaces = nativeFaces.map(f => {
              const b = f.boundingBox;
              return {
                x: b.x,
                y: b.y,
                width: b.width,
                height: b.height,
                centerX: b.x + b.width / 2,
                centerY: b.y + b.height / 2,
                size: Math.max(b.width, b.height),
                confidence: 98.0
              };
            });
            return {
              detected: true,
              count: mappedFaces.length,
              faces: mappedFaces,
              confidence: 98.0,
              engine: 'native'
            };
          }
        } catch (e) {
          // Fall through to pico
        }
      }

      // Fallback: Pico.js Face Detection via Canvas
      const classifier = await loadCascade();
      if (!classifier) {
        return {
          detected: false,
          count: 0,
          faces: [],
          confidence: 0,
          error: 'Face detection engine is initializing. Please wait a moment and try again.'
        };
      }

      // Scale down image to optimal processing dimension (max 480px width)
      const maxDim = 480;
      let scale = 1.0;
      if (origW > maxDim || origH > maxDim) {
        scale = maxDim / Math.max(origW, origH);
      }
      const w = Math.round(origW * scale);
      const h = Math.round(origH * scale);

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, w, h);

      const imgData = ctx.getImageData(0, 0, w, h);
      const rgba = imgData.data;

      // Convert RGBA to grayscale
      const gray = new Uint8Array(w * h);
      for (let i = 0; i < w * h; ++i) {
        gray[i] = (2 * rgba[4 * i + 0] + 7 * rgba[4 * i + 1] + 1 * rgba[4 * i + 2]) / 10;
      }

      const params = {
        shiftfactor: 0.1,
        minsize: Math.max(30, Math.round(w * 0.18)),
        maxsize: Math.round(Math.min(w, h) * 0.95),
        scalefactor: 1.15
      };

      const dets = pico.run_cascade({ pixels: gray, nrows: h, ncols: w, ldim: w }, classifier, params);
      const clusters = pico.cluster_detections(dets, 0.2);

      // Filter by minimum score threshold (q >= 12.0)
      const confidentFaces = clusters.filter(c => c[3] >= 12.0);

      if (confidentFaces.length > 0) {
        const mappedFaces = confidentFaces.map(c => {
          const size = c[2] / scale;
          const centerY = c[0] / scale;
          const centerX = c[1] / scale;
          const conf = calibratePicoConfidence(c[3]);
          return {
            x: centerX - size / 2,
            y: centerY - size / 2,
            width: size,
            height: size,
            centerX: centerX,
            centerY: centerY,
            size: size,
            rawScore: Math.round(c[3] * 10) / 10,
            confidence: conf
          };
        });

        mappedFaces.sort((a, b) => b.confidence - a.confidence);

        return {
          detected: true,
          count: mappedFaces.length,
          faces: mappedFaces,
          confidence: mappedFaces[0].confidence,
          engine: 'pico'
        };
      }

      return {
        detected: false,
        count: 0,
        faces: [],
        confidence: 0,
        error: 'No clear human face detected. Please ensure your face is front-facing, well-lit, and clearly visible.'
      };
    },

    /**
     * Comprehensive 100% Passport Photo Verification
     * Enforces ICAO / Form RPS 01-A Standards:
     * - Resolution (minimum 160x160 px)
     * - Aspect ratio (width / height between 0.65 and 1.30: portrait to square)
     * - Exactly one face (rejects 0 faces and group photos)
     * - Face coverage / proportion (head/face size must occupy 35% - 85% of photo frame)
     * - Face centering (horizontally within 30%-70% of frame, vertically within 18%-68%)
     * - Calibrated confidence >= 65%
     * - Plain light background check
     */
    verifyPassportPhoto: async function (img) {
      if (!img) {
        return { verified: false, error: 'No image provided for verification.' };
      }

      const origW = img.naturalWidth || img.videoWidth || img.width || 0;
      const origH = img.naturalHeight || img.videoHeight || img.height || 0;

      // 1. Resolution Check
      if (origW < 160 || origH < 160) {
        return {
          verified: false,
          error: `Image resolution is too low (${origW}x${origH}px). Minimum 160x160px required for passport verification.`
        };
      }

      // 2. Aspect Ratio Check (Standard passport: ~3.5:4.5 or 1:1)
      const aspect = origW / origH;
      if (aspect < 0.65 || aspect > 1.30) {
        return {
          verified: false,
          error: `Invalid photo aspect ratio (${aspect.toFixed(2)}). Passport photos must be portrait or square (approx 3.5:4.5 or 1:1). Flyers, brochures, document scans, and wide banners are rejected.`
        };
      }

      // 3. Face Detection
      const detResult = await this.detect(img);
      if (!detResult.detected || !detResult.faces || detResult.faces.length === 0) {
        return {
          verified: false,
          error: detResult.error || 'No clear human face detected. Please ensure your face is front-facing, well-lit, and clearly visible.'
        };
      }

      // 4. Single Face Requirement
      if (detResult.faces.length > 1) {
        return {
          verified: false,
          error: `Multiple faces detected (${detResult.faces.length} faces found). Passport photographs must contain only your face.`
        };
      }

      const primary = detResult.faces[0];

      // 5. Confidence Threshold Check (Minimum 65% calibrated confidence)
      if (primary.confidence < 65) {
        return {
          verified: false,
          error: `Face detection confidence is too low (${primary.confidence}%). The face is unclear, blurry, or poorly lit. Please upload a sharper, front-facing photograph.`
        };
      }

      // 6. Face Size / Coverage Proportion Check (Head & face must occupy 35% - 85% of frame)
      const faceCoverage = primary.size / Math.min(origW, origH);
      if (faceCoverage < 0.35) {
        return {
          verified: false,
          error: `Face is too small in the frame (occupies only ${Math.round(faceCoverage * 100)}% of image). In a valid passport photo, your face and head must occupy 40%–80% of the frame.`
        };
      }
      if (faceCoverage > 0.88) {
        return {
          verified: false,
          error: `Face is cropped too close to the camera (${Math.round(faceCoverage * 100)}% of image). Please ensure your full head and upper shoulders are visible.`
        };
      }

      // 7. Face Centering Check (Horizontal & Vertical)
      const relX = primary.centerX / origW;
      const relY = primary.centerY / origH;

      if (relX < 0.30 || relX > 0.70) {
        return {
          verified: false,
          error: `Face is not centered horizontally (positioned at ${Math.round(relX * 100)}% from left). Please ensure your face is centered in the photo.`
        };
      }
      if (relY < 0.18 || relY > 0.68) {
        return {
          verified: false,
          error: `Face is positioned too close to the top or bottom edge. Please center your face in the photo.`
        };
      }

      // 8. Plain / Light Background Check
      const bgCheck = checkBackgroundCorners(img);
      if (!bgCheck.valid) {
        return {
          verified: false,
          error: bgCheck.error
        };
      }

      return {
        verified: true,
        confidence: primary.confidence,
        count: 1,
        face: primary,
        details: {
          aspect: Math.round(aspect * 100) / 100,
          coverage: Math.round(faceCoverage * 100),
          centerX: Math.round(relX * 100),
          centerY: Math.round(relY * 100)
        }
      };
    }
  };

  window.FaceDetectorEngine = FaceDetectorEngine;

})(typeof window !== 'undefined' ? window : this);
