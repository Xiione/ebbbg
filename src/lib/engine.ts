import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

import type { ShaderType } from "./types";

import type BackgroundLayer from "$lib/rom/BackgroundLayer";
import { SNES_WIDTH, SNES_HEIGHT } from "$lib/constants";

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
  private shaderPass: ShaderPass | null = null;

  // Animation frames storage
  private preRenderedFrames: Uint8Array[] = [];
  private currentFrameIndex: number = 0;
  private totalFrameCount: number = 0;
  private isPreRendering: boolean = false;
  private isAnimationLooping: boolean = false;

  // Shader management
  private currentShader: ShaderType = "none";
  private shaderLoaded: boolean = false;

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
    this.initThreeJS();

    // Load initial shader if specified
    this.loadShader(opts.initialShader);
  }

  private initThreeJS() {
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
    this.renderer.domElement.style.imageRendering = "crisp-edges";
    // this.renderer.domElement.style.imageRendering = "pixelated";
    this.containerElement.appendChild(this.renderer.domElement);

    this.pixelData = new Uint8Array(SNES_WIDTH * SNES_HEIGHT * 4);
    this.pixelTexture = new THREE.DataTexture(
      this.pixelData,
      SNES_WIDTH,
      SNES_HEIGHT,
      THREE.RGBAFormat,
    );
    this.pixelTexture.minFilter = THREE.LinearFilter;
    this.pixelTexture.magFilter = THREE.LinearFilter;
    this.pixelTexture.colorSpace = THREE.SRGBColorSpace;
    this.pixelTexture.generateMipmaps = false;
    this.pixelTexture.needsUpdate = true;

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

  async loadShader(shaderType: ShaderType, userParams: Record<string, any> = {}) {
    this.disableShader();

    if (shaderType === "none") {
      return;
    }

    try {
      // will need to generalize to shaders with multiple passes
      const fragmentShader = (
        await import(`./shaders/${shaderType}/frag.glsl?raw`)
      ).default;
      const vertexShader = (
        await import(`./shaders/${shaderType}/vert.glsl?raw`)
      ).default;
      const uniformValues = (
        await import(`./shaders/${shaderType}/uniforms.js`)
      )?.default ?? {}; // possibly no uniforms

      const customShader = {
        vertexShader,
        fragmentShader,
        uniforms: {
          ...objToUniforms(uniformValues),
          ...objToUniforms(userParams), // overrides default uniform values

          tDiffuse: { value: this.pixelTexture },
          resolution: {
            value: new THREE.Vector2(
              SNES_WIDTH * this.renderScale,
              SNES_HEIGHT * this.renderScale,
            ),
          },
          sourceResolution: {
            value: new THREE.Vector2(SNES_WIDTH, SNES_HEIGHT),
          },
          pixelSize: { value: this.renderScale },
        },
      };

      // Create shader pass and add to composer
      this.shaderPass = new ShaderPass(customShader);
      this.shaderPass.renderToScreen = true;
      this.composer.addPass(this.shaderPass);

      this.currentShader = shaderType;
      this.shaderLoaded = true;

      console.log(`Loaded shader: ${shaderType}`);
    } catch (error) {
      console.error(`Failed to load shader: ${shaderType}`, error);
    }
  }

  private disableShader() {
    if (this.currentShader === "none") return;

    // Remove shader pass if exists
    if (this.shaderPass) {
      this.composer.removePass(this.shaderPass);
      this.shaderPass = null;
    }

    this.currentShader = "none";
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

  // Public methods for controlling the engine

  public getCurrentShader(): ShaderType {
    return this.currentShader;
  }

  public async setShader(shaderType: ShaderType) {
    await this.loadShader(shaderType);
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

    // Update mesh geometry
    this.scene.children.forEach((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry = new THREE.PlaneGeometry(outputWidth, outputHeight);
      }
    });

    // Update shader uniforms if active
    if (this.shaderPass) {
      this.shaderPass.uniforms.resolution.value.set(outputWidth, outputHeight);
      this.shaderPass.uniforms.pixelSize.value = this.renderScale;
    }

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
