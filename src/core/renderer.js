import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

const FinalShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uVignette: { value: 0.55 },
    uGrain: { value: 0.03 },
    uCA: { value: 0.0022 },
    uScan: { value: 0 },
    uBlur: { value: 0 },
    uFlash: { value: 0 },
    uFlashCol: { value: new THREE.Color(1, 1, 1) },
    uSat: { value: 1.08 },
    uLift: { value: new THREE.Color(0.0, 0.0, 0.015) },
    uDim: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uVignette, uGrain, uCA, uScan, uBlur, uFlash, uSat, uDim;
    uniform vec2 uRes;
    uniform vec3 uFlashCol, uLift;
    varying vec2 vUv;
    float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    void main(){
      vec2 uv = vUv;
      vec2 dc = uv - vec2(0.5, 0.46);
      vec3 col;
      if (uBlur > 0.002) {
        col = vec3(0.0);
        float edge = smoothstep(0.08, 0.5, length(dc));
        for (int i = 0; i < 7; i++) {
          float t = float(i) / 6.0;
          col += texture2D(tDiffuse, uv - dc * t * uBlur * 0.07 * edge).rgb;
        }
        col /= 7.0;
      } else {
        col = texture2D(tDiffuse, uv).rgb;
      }
      float ca = uCA * dot(dc, dc) * 4.0;
      col.r = mix(col.r, texture2D(tDiffuse, uv - dc * ca).r, 0.85);
      col.b = mix(col.b, texture2D(tDiffuse, uv + dc * ca).b, 0.85);
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(l), col, uSat);
      col += uLift * (1.0 - l);
      float v = smoothstep(0.32, 0.95, length(dc * vec2(1.0, 0.82)));
      col *= 1.0 - uVignette * v;
      col += (h12(uv * uRes + fract(uTime * 37.0) * 100.0) - 0.5) * uGrain;
      if (uScan > 0.0) {
        float sl = 0.5 + 0.5 * sin(uv.y * uRes.y * 1.5708);
        col *= 1.0 - uScan * 0.35 * sl;
        col *= 1.0 - uScan * 0.12 * (0.5 + 0.5 * sin(uv.x * uRes.x * 3.14159));
      }
      col *= 1.0 - uDim;
      col = mix(col, uFlashCol, uFlash);
      gl_FragColor = vec4(col, 1.0);
    }`,
};

// guards the bloom chain: one NaN pixel would otherwise black out the frame
const SanitizeShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      if (any(isnan(c)) || any(isinf(c))) c = vec4(0.0, 0.0, 0.0, 1.0);
      gl_FragColor = vec4(clamp(c.rgb, 0.0, 48.0), 1.0);
    }`,
};

export const QUALITY = {
  low: { pr: 0.7, msaa: 0, bloom: true, bloomScale: 0.35 },
  medium: { pr: 1.0, msaa: 2, bloom: true, bloomScale: 0.5 },
  high: { pr: 1.5, msaa: 4, bloom: true, bloomScale: 0.5 },
};

export class Renderer {
  constructor(canvas, quality = 'high') {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.3, 6000);
    this.setQuality(quality);
    window.addEventListener('resize', () => this.resize());
  }

  setQuality(q) {
    this.qname = q;
    this.q = QUALITY[q] || QUALITY.high;
    this._build();
    this.resize();
  }

  _build() {
    if (this.composer) this.composer.dispose?.();
    const size = new THREE.Vector2();
    this.renderer.getSize(size);
    const rt = new THREE.WebGLRenderTarget(Math.max(1, size.x), Math.max(1, size.y), { type: THREE.HalfFloatType, samples: this.q.msaa });
    this.composer = new EffectComposer(this.renderer, rt);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);
    this.sanitize = new ShaderPass(SanitizeShader);
    this.composer.addPass(this.sanitize);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.85, 0.55, 0.82);
    this.bloom.enabled = this.q.bloom;
    this.composer.addPass(this.bloom);
    this.output = new OutputPass();
    this.composer.addPass(this.output);
    this.final = new ShaderPass(FinalShader);
    this.composer.addPass(this.final);
  }

  resize() {
    const w = Math.floor(window.innerWidth), h = Math.floor(window.innerHeight);
    const pr = Math.min(window.devicePixelRatio || 1, this.q.pr);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w * pr * this.q.bloomScale, h * pr * this.q.bloomScale);
    this.bloom.setSize(w * pr * this.q.bloomScale, h * pr * this.q.bloomScale);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.final.uniforms.uRes.value.set(Math.floor(w * pr), Math.floor(h * pr));
  }

  render(dt) {
    this.final.uniforms.uTime.value += dt;
    this.composer.render(dt);
  }
}
