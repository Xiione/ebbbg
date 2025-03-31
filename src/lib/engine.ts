import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

import type { ShaderPreset, ShaderType } from "./types";

import type BackgroundLayer from "$lib/rom/BackgroundLayer";
import { SNES_WIDTH, SNES_HEIGHT } from "$lib/constants";

const SHADER_DIR = "shaders";

export interface EngineOptions {
  fps: number;
  aspectRatio: number;
  frameSkip: number;
  alpha: number[];
  containerElement: HTMLElement;
  initialShader: ShaderType;
  renderScale: number; // Scale factor for rendering resolution
  preRenderFrames: number; // Number of frames to pre-render (0 for real-time)
}

export default class Engine {
  private fps: number;
  private aspectRatio: number;
  private frameSkip: number;
  private alpha: number[];
  private containerElement: HTMLElement;
  private tick: number = 0;
  private renderScale: number;
  private preRenderFrames: number;

  // Three.js elements
  // initialized separately in initThreeJS
  private scene!: THREE.Scene;
  private camera!: THREE.OrthographicCamera;
  private renderer!: THREE.WebGLRenderer;
  private composer!: EffectComposer;
  private pixelData!: Uint8Array;
  private pixelTexture!: THREE.DataTexture;

  // Animation frames storage
  private preRenderedFrames: Uint8Array[] = [];
  private currentFrameIndex: number = 0;
  private totalFrameCount: number = 0;
  private isPreRendering: boolean = false;
  private isAnimationLooping: boolean = false;

  // Shader management
  private shaderLoading: Promise<any> = Promise.resolve();
  private shaderPasses: ShaderPass[] = [];

  constructor(
    public layers: BackgroundLayer[] = [],
    opts: EngineOptions,
  ) {
    this.layers = layers;
    this.fps = opts.fps;
    this.aspectRatio = opts.aspectRatio;
    this.frameSkip = opts.frameSkip;
    this.alpha = opts.alpha;
    this.containerElement = opts.containerElement;
    this.renderScale = opts.renderScale;
    this.preRenderFrames = opts.preRenderFrames;

    // Initialize Three.js
    this.initThree();

    // Load initial shader if specified
    this.loadShader(opts.initialShader);
  }

  private initThree() {
    const outputWidth = SNES_WIDTH * this.renderScale;
    const outputHeight = SNES_HEIGHT * this.renderScale;

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(
      -outputWidth / 2,
      outputWidth / 2,
      outputHeight / 2,
      -outputHeight / 2,
      0.1,
      1000,
    );
    this.camera.position.z = 10;

    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: "high-performance",
      precision: "highp",
    });

    this.renderer.setSize(outputWidth, outputHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(1);
    this.containerElement.appendChild(this.renderer.domElement);

    this.pixelData = new Uint8Array(SNES_WIDTH * SNES_HEIGHT * 4);
    this.pixelTexture = new THREE.DataTexture(
      this.pixelData,
      SNES_WIDTH,
      SNES_HEIGHT,
      THREE.RGBAFormat,
    );

    this.pixelTexture.minFilter = THREE.NearestFilter;
    this.pixelTexture.magFilter = THREE.NearestFilter;
    this.pixelTexture.colorSpace = THREE.SRGBColorSpace;
    this.pixelTexture.generateMipmaps = false;
    this.pixelTexture.needsUpdate = true;
    this.pixelTexture.flipY = true; // canvas order to texture order

    const planeGeometry = new THREE.PlaneGeometry(outputWidth, outputHeight);
    const planeMaterial = new THREE.MeshBasicMaterial({
      map: this.pixelTexture,
      transparent: true,
    });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    this.scene.add(plane);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    // Force aspect ratio
    this.updateAspectRatio();
    window.addEventListener("resize", () => this.updateAspectRatio());
  }

  private updateAspectRatio() {
    const containerWidth = this.containerElement.clientWidth;
    const containerHeight = this.containerElement.clientHeight;

    const outputWidth = SNES_WIDTH * this.renderScale;
    const outputHeight = SNES_HEIGHT * this.renderScale;

    let scaleFactor: number;

    if (containerWidth / containerHeight > outputWidth / outputHeight) {
      // Container is wider than the output
      scaleFactor = containerHeight / outputHeight;
    } else {
      // Container is taller than the output
      scaleFactor = containerWidth / outputWidth;
    }

    this.renderer.domElement.style.width = `${outputWidth * scaleFactor}px`;
    this.renderer.domElement.style.height = `${outputHeight * scaleFactor}px`;
  }

  async loadShader(
    shaderType: ShaderType,
    userParams: Record<string, any> = {},
  ) {
    await this.shaderLoading;

    try {
      const preset = (await import(`./${SHADER_DIR}/${shaderType}/preset.ts`))
        .default as ShaderPreset;

      const filter = preset.filterLinear
        ? THREE.LinearFilter
        : THREE.NearestFilter;
      this.pixelTexture.minFilter = filter;
      this.pixelTexture.magFilter = filter;

      this.renderer.domElement.style.imageRendering =
        preset.imageRendering ?? "auto";

      await Promise.all(
        preset.passes.map(async (passName, passNum) => {
          const vertexShader = (
            await import(`./${SHADER_DIR}/${shaderType}/${passName}.vert?raw`)
          ).default;
          const fragmentShader = (
            await import(`./${SHADER_DIR}/${shaderType}/${passName}.frag?raw`)
          ).default;

          const OutputSize = {
            value: new THREE.Vector2(
              SNES_WIDTH * this.renderScale,
              SNES_HEIGHT * this.renderScale,
            ),
          };

          const pass = new ShaderPass({
            vertexShader,
            fragmentShader,
            uniforms: {
              PixelSize: { value: this.renderScale },
              ...objToUniforms(preset.uniforms ?? {}),
              ...objToUniforms(userParams), // overrides default uniform values

              tDiffuse: { value: this.pixelTexture },
              InputSize:
                passNum > 0
                  ? OutputSize // only first pass does upscaling
                  : {
                      value: new THREE.Vector2(SNES_WIDTH, SNES_HEIGHT),
                    },
              OutputSize,
            },
          });

          this.shaderPasses.push(pass);
          pass.renderToScreen = true;
          this.composer.addPass(pass);
        }),
      );
      console.log(`Loaded shader: ${shaderType}`);
    } catch (error) {
      console.error(`Failed to load shader: ${shaderType}`, error);
    }
  }

  private disableShader() {
    // Remove shader pass if exists
    this.shaderPasses.map((pass) => this.composer.removePass(pass));
    this.loadShader("none");
  }

  private renderFrame(buf: Uint8Array, tick: number) {
    for (let i = 0; i < this.layers.length; ++i) {
      buf.set(
        this.layers[i].overlayFrame(
          buf,
          this.aspectRatio,
          tick,
          this.alpha[i],
          i === 0,
        ),
      );
    }
  }

  private preRenderAnimation() {
    this.isPreRendering = true;
    this.preRenderedFrames = [];
    this.totalFrameCount = 0;

    // Calculate how many frames to pre-render
    const frameCount = this.preRenderFrames;

    console.log(`Pre-rendering ${frameCount} frames...`);

    // Pre-render each frame
    for (let i = 0; i < frameCount; i++) {
      const tick = i * this.frameSkip;
      const frameData = new Uint8Array(SNES_WIDTH * SNES_HEIGHT * 4);
      this.renderFrame(frameData, tick);
      this.preRenderedFrames.push(frameData);
      this.totalFrameCount++;
    }

    console.log(`Pre-rendered ${this.totalFrameCount} frames`);
    this.isPreRendering = false;
    this.isAnimationLooping = true;
  }

  animate(): () => void {
    let frameID = -1;
    let then = Date.now();
    let elapsed: number;
    const fpsInterval = 1000 / this.fps;

    // Pre-render animation frames if needed
    if (this.preRenderFrames > 0) {
      this.preRenderAnimation();
    }

    const animateFrame = () => {
      frameID = requestAnimationFrame(animateFrame);
      const now = Date.now();
      elapsed = now - then;

      if (elapsed > fpsInterval) {
        then = now - (elapsed % fpsInterval);

        if (this.isAnimationLooping && this.preRenderedFrames.length > 0) {
          // Use pre-rendered frame
          this.pixelData.set(this.preRenderedFrames[this.currentFrameIndex]);

          this.currentFrameIndex =
            (this.currentFrameIndex + 1) % this.totalFrameCount;
        } else {
          // Render frame in real-time
          this.renderFrame(this.pixelData, this.tick);
          this.tick += this.frameSkip;
        }
        this.pixelTexture.needsUpdate = true;

        // Render with the shader
        this.composer.render();
      }
    };

    if (frameID > 0) {
      cancelAnimationFrame(frameID);
    }

    animateFrame();

    // Return cleanup function
    return () => {
      if (frameID > 0) {
        cancelAnimationFrame(frameID);
      }
    };
  }

  public setPreRenderFrames(frames: number) {
    this.preRenderFrames = frames;
    if (frames > 0) {
      this.preRenderAnimation();
    } else {
      this.isAnimationLooping = false;
    }
  }

  public setRenderScale(scale: number) {
    this.renderScale = scale;
    const outputWidth = SNES_WIDTH * this.renderScale;
    const outputHeight = SNES_HEIGHT * this.renderScale;

    // Update renderer size
    this.renderer.setSize(outputWidth, outputHeight);
    this.composer.setSize(outputWidth, outputHeight);

    // Update camera
    this.camera.left = -outputWidth / 2;
    this.camera.right = outputWidth / 2;
    this.camera.top = outputHeight / 2;
    this.camera.bottom = -outputHeight / 2;
    this.camera.updateProjectionMatrix();

    this.scene.children.forEach((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry = new THREE.PlaneGeometry(outputWidth, outputHeight);
      }
    });

    this.shaderPasses.forEach((pass) => {
      pass.uniforms.resolution.value.set(outputWidth, outputHeight);
      pass.uniforms.pixelSize.value = this.renderScale;
    });

    this.updateAspectRatio();
  }

  public resize() {
    this.updateAspectRatio();
  }
}

/**
 * Takes an object and wraps its values v with { value: v } for use as a
 * uniforms object expected by three.js's ShaderPass.
 */
function objToUniforms(obj: Record<string, any>) {
  return Object.entries(obj).reduce(
    (o, [k, value]) => {
      o[k] = { value };
      return o;
    },
    {} as Record<string, any>,
  );
}
