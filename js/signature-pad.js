/**
 * Sea & Seas Shipping Private Limited
 * Interactive Signature Pad with Strict Quality & Ink Validation
 * Supports touch, pen, mouse drawing and file uploads with pixel density analysis
 */

(function (window) {
  'use strict';

  class SignaturePad {
    constructor(canvas, options = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { willReadFrequently: true });
      this.options = Object.assign({
        strokeColor: '#071b34',
        strokeWidth: 2.5,
        minPoints: 20,
        minWidth: 50,
        minHeight: 18,
        minInkPixels: 150,
        maxInkPercent: 40,
        onStrokeEnd: null
      }, options);

      this.isDrawing = false;
      this.points = [];
      this.strokes = [];
      this.currentStroke = [];
      this.hasDrawn = false;

      this.initCanvas();
      this.bindEvents();
    }

    initCanvas() {
      const dpr = window.devicePixelRatio || 1;
      const rect = this.canvas.getBoundingClientRect();
      const displayWidth = rect.width || 420;
      const displayHeight = rect.height || 140;

      this.canvas.width = Math.round(displayWidth * dpr);
      this.canvas.height = Math.round(displayHeight * dpr);
      this.ctx.scale(dpr, dpr);

      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.strokeStyle = this.options.strokeColor;
      this.ctx.lineWidth = this.options.strokeWidth;
      this.clear();
    }

    bindEvents() {
      const getPos = (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
          x: clientX - rect.left,
          y: clientY - rect.top
        };
      };

      const start = (e) => {
        if (e.cancelable && e.type.startsWith('touch')) e.preventDefault();
        this.isDrawing = true;
        const pos = getPos(e);
        this.currentStroke = [pos];
        this.points.push(pos);

        this.ctx.beginPath();
        this.ctx.moveTo(pos.x, pos.y);
      };

      const move = (e) => {
        if (!this.isDrawing) return;
        if (e.cancelable && e.type.startsWith('touch')) e.preventDefault();
        const pos = getPos(e);
        this.currentStroke.push(pos);
        this.points.push(pos);

        this.ctx.lineTo(pos.x, pos.y);
        this.ctx.stroke();
      };

      const end = (e) => {
        if (!this.isDrawing) return;
        this.isDrawing = false;
        if (this.currentStroke.length > 0) {
          this.strokes.push(this.currentStroke);
          this.hasDrawn = true;
        }
        if (typeof this.options.onStrokeEnd === 'function') {
          this.options.onStrokeEnd(this.validate());
        }
      };

      // Pointer / Mouse events
      this.canvas.addEventListener('mousedown', start);
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', end);

      // Touch events
      this.canvas.addEventListener('touchstart', start, { passive: false });
      window.addEventListener('touchmove', move, { passive: false });
      window.addEventListener('touchend', end);
      window.addEventListener('touchcancel', end);

      window.addEventListener('resize', () => {
        // preserve current drawing on resize
        const prevData = this.isEmpty() ? null : this.canvas.toDataURL();
        this.initCanvas();
        if (prevData) {
          const img = new Image();
          img.onload = () => {
            const dpr = window.devicePixelRatio || 1;
            this.ctx.drawImage(img, 0, 0, this.canvas.width / dpr, this.canvas.height / dpr);
          };
          img.src = prevData;
        }
      });
    }

    clear() {
      const dpr = window.devicePixelRatio || 1;
      this.ctx.clearRect(0, 0, this.canvas.width / dpr, this.canvas.height / dpr);
      this.points = [];
      this.strokes = [];
      this.currentStroke = [];
      this.hasDrawn = false;
      if (typeof this.options.onStrokeEnd === 'function') {
        this.options.onStrokeEnd({ valid: false, error: 'Signature is blank' });
      }
    }

    isEmpty() {
      return !this.hasDrawn || this.points.length === 0;
    }

    /**
     * Performs strict validation on drawn signature
     * @returns {{valid: boolean, dataUrl?: string, error?: string, pointCount?: number, inkPixels?: number}}
     */
    validate() {
      if (this.isEmpty()) {
        return { valid: false, error: 'Please draw your signature in the box provided.' };
      }

      if (this.points.length < this.options.minPoints) {
        return { valid: false, error: 'Signature is too short. Please provide a complete signature.' };
      }

      // Check bounding box
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const p of this.points) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }

      const width = maxX - minX;
      const height = maxY - minY;

      if (width < this.options.minWidth || height < this.options.minHeight) {
        return { valid: false, error: 'Signature is too small. Please sign clearly across the signature area.' };
      }

      // Pixel density check
      const w = this.canvas.width;
      const h = this.canvas.height;
      const imgData = this.ctx.getImageData(0, 0, w, h);
      const data = imgData.data;
      let inkPixels = 0;

      for (let i = 0; i < data.length; i += 4) {
        // Alpha > 20 and dark color (not transparent)
        if (data[i + 3] > 20) {
          inkPixels++;
        }
      }

      const totalPixels = w * h;
      const inkPercent = (inkPixels / totalPixels) * 100;

      if (inkPixels < this.options.minInkPixels) {
        return { valid: false, error: 'Signature stroke density is too low. Please sign clearly.' };
      }

      if (inkPercent > this.options.maxInkPercent) {
        return { valid: false, error: 'Excessive scribble detected. Please provide a standard legible signature.' };
      }

      return {
        valid: true,
        dataUrl: this.canvas.toDataURL('image/png'),
        pointCount: this.points.length,
        strokeCount: this.strokes.length,
        inkPixels: inkPixels,
        width: Math.round(width),
        height: Math.round(height)
      };
    }

    /**
     * Statically validates an uploaded signature image file
     * @param {File|Blob} file
     * @returns {Promise<{valid: boolean, dataUrl?: string, error?: string}>}
     */
    static async validateImageFile(file) {
      if (!file) {
        return { valid: false, error: 'No signature file provided.' };
      }

      if (file.size > 2 * 1024 * 1024) {
        return { valid: false, error: 'Signature file exceeds 2 MB. Please use a smaller file.' };
      }

      if (file.size < 1024) {
        return { valid: false, error: 'Signature file is unusually small.' };
      }

      const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
      if (!validTypes.includes(file.type.toLowerCase())) {
        return { valid: false, error: 'Upload signature in PNG, JPG or WebP format.' };
      }

      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const w = img.width;
            const h = img.height;

            if (w < 80 || h < 20) {
              resolve({ valid: false, error: 'Signature resolution is too small (minimum 80x20 px).' });
              return;
            }

            // Signatures should generally be wider than tall or reasonable ratio
            if (h > w * 1.5) {
              resolve({ valid: false, error: 'Signature should be horizontal orientation.' });
              return;
            }

            // Offscreen canvas analysis
            const c = document.createElement('canvas');
            c.width = w;
            c.height = h;
            const ctx = c.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(img, 0, 0, w, h);

            const imgData = ctx.getImageData(0, 0, w, h);
            const data = imgData.data;
            let darkInkPixels = 0;
            let totalPixels = w * h;

            for (let i = 0; i < data.length; i += 4) {
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];
              const a = data[i + 3];

              // Check if pixel is dark ink on light background or transparent
              if (a > 50) {
                const brightness = (0.299 * r + 0.587 * g + 0.114 * b);
                if (brightness < 180) {
                  darkInkPixels++;
                }
              }
            }

            const inkPercent = (darkInkPixels / totalPixels) * 100;

            if (inkPercent < 0.2) {
              resolve({ valid: false, error: 'Image appears blank or lacks visible signature ink.' });
              return;
            }

            if (inkPercent > 45.0) {
              resolve({ valid: false, error: 'Image is too dark or dense for a signature. Please upload clean ink on white background.' });
              return;
            }

            resolve({
              valid: true,
              dataUrl: c.toDataURL('image/png'),
              width: w,
              height: h
            });
          };
          img.onerror = () => resolve({ valid: false, error: 'Corrupt or unreadable image file.' });
          img.src = e.target.result;
        };
        reader.onerror = () => resolve({ valid: false, error: 'Failed to read signature file.' });
        reader.readAsDataURL(file);
      });
    }
  }

  window.SignaturePad = SignaturePad;

})(typeof window !== 'undefined' ? window : this);
