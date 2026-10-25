// Texture atlas with a shelf packer. Each region is painted by a callback that
// receives the colour context and (optionally) an emissive context. Regions
// are padded with wrapped copies of their own edges so tiling in the shader
// (fract inside region) does not bleed.

import * as THREE from 'three';
import { GRIME } from './paint.js';

export class Atlas {
  constructor(size, { emissive = true, emissiveScale = 0.5, alpha = false, bg = '#7f7f7f' } = {}) {
    this.size = size;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = size;
    this.ctx = this.canvas.getContext('2d');
    if (!alpha) {
      this.ctx.fillStyle = bg;
      this.ctx.fillRect(0, 0, size, size);
    }
    this.alpha = alpha;
    this.es = emissiveScale;
    if (emissive) {
      this.ecanvas = document.createElement('canvas');
      this.ecanvas.width = this.ecanvas.height = Math.round(size * emissiveScale);
      this.ectx = this.ecanvas.getContext('2d');
      this.ectx.fillStyle = '#000';
      this.ectx.fillRect(0, 0, this.ecanvas.width, this.ecanvas.height);
    }
    this.regions = {};
    this.rects = {};
    this.sx = 0; this.sy = 0; this.sh = 0;
    this.pad = 4;
  }

  alloc(w, h) {
    const p = this.pad;
    if (this.sx + w + p * 2 > this.size) {
      this.sx = 0;
      this.sy += this.sh;
      this.sh = 0;
    }
    const r = { x: this.sx + p, y: this.sy + p, w, h };
    this.sx += w + p * 2;
    this.sh = Math.max(this.sh, h + p * 2);
    if (r.y + h > this.size) console.warn('[atlas] overflow', w, h);
    return r;
  }

  add(name, w, h, draw, { wrap = true } = {}) {
    const r = this.alloc(w, h);
    const { ctx, ectx } = this;
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.clip();
    let e = null;
    if (ectx) {
      ectx.save();
      ectx.scale(this.es, this.es);
      ectx.translate(r.x, r.y);
      ectx.beginPath();
      ectx.rect(0, 0, w, h);
      ectx.clip();
      e = ectx;
    }
    draw(ctx, e, w, h);
    ctx.restore();
    if (ectx) ectx.restore();
    if (wrap) {
      this._wrapPad(this.ctx, this.canvas, r, 1);
      if (ectx) this._wrapPad(this.ectx, this.ecanvas, r, this.es);
    }
    const S = this.size;
    const inset = 1.0;
    const reg = [(r.x + inset) / S, 1 - (r.y + r.h - inset) / S, (r.w - inset * 2) / S, (r.h - inset * 2) / S];
    this.regions[name] = reg;
    this.rects[name] = r;
    return reg;
  }

  _wrapPad(ctx, cv, r, sc) {
    const p = Math.max(1, Math.round(this.pad * sc));
    const x = Math.round(r.x * sc), y = Math.round(r.y * sc), w = Math.round(r.w * sc), h = Math.round(r.h * sc);
    if (w <= p || h <= p) return;
    // left pad <- right edge
    ctx.drawImage(cv, x + w - p, y, p, h, x - p, y, p, h);
    ctx.drawImage(cv, x, y, p, h, x + w, y, p, h);
    ctx.drawImage(cv, x, y + h - p, w, p, x, y - p, w, p);
    ctx.drawImage(cv, x, y, w, p, x, y + h, w, p);
  }

  get(name) {
    const r = this.regions[name];
    if (!r) {
      console.warn('[atlas] missing region', name);
      return [0, 0, 0.001, 0.001];
    }
    return r;
  }

  textures(renderer) {
    const mk = (cv) => {
      const t = new THREE.CanvasTexture(cv);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = renderer ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 4;
      t.generateMipmaps = true;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.needsUpdate = true;
      return t;
    };
    this.map = mk(this.canvas);
    if (this.ecanvas) this.emap = mk(this.ecanvas);
    return this;
  }
}

// cached grain pattern
let grainCv = null;
export function grain(ctx, x, y, w, h, alpha = 0.12, seed = 7) {
  if (!GRIME) return;
  if (!grainCv) {
    grainCv = document.createElement('canvas');
    grainCv.width = grainCv.height = 128;
    const g = grainCv.getContext('2d');
    const img = g.createImageData(128, 128);
    let a = seed;
    for (let i = 0; i < img.data.length; i += 4) {
      a = (a * 1103515245 + 12345) & 0x7fffffff;
      const v = (a >> 16) & 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = 'overlay';
  const pat = ctx.createPattern(grainCv, 'repeat');
  ctx.fillStyle = pat;
  ctx.translate(x, y);
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}
