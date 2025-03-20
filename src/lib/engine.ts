import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { GammaCorrectionShader } from "three/examples/jsm/shaders/GammaCorrectionShader.js";

import type { ShaderType } from "./types";

import type BackgroundLayer from "$lib/rom/BackgroundLayer";
import { SNES_WIDTH, SNES_HEIGHT } from "$lib/constants";
import { loadShader, preloadShaders } from "./ShaderLoader";

export interface EngineOptions {
  fps: number;
  aspectRatio: number;
  frameSkip: number;
  alpha: number[];
  containerElement: HTMLElement;
  initialShader?: ShaderType;
  renderScale?: number; // Scale factor for rendering resolution
  preRenderFrames?: number; // Number of frames to pre-render (0 for real-time)
  preloadShaders?: ShaderType[]; // Shaders to preload
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
  private renderTarget!: THREE.WebGLRenderTarget;
  private pixelRenderTarget!: THREE.WebGLRenderTarget;
  private pixelData!: Uint8Array;
  private pixelScene!: THREE.Scene;
  private pixelCamera!: THREE.OrthographicCamera;
  private pixelTexture!: THREE.DataTexture;
  private pixelMesh!: THREE.Mesh;
  private displayMesh!: THREE.Mesh;

  // Animation frames storage
  private preRenderedFrames: THREE.Texture[] = [];
  private currentFrameIndex: number = 0;
  private totalFrameCount: number = 0;
  private isPreRendering: boolean = false;
  private isAnimationLooping: boolean = false;

  // Shader management
  private currentShader: ShaderType = "none";
  private shaderPasses: Map<ShaderType, ShaderPass> = new Map();
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
    this.renderScale = opts.renderScale || 4; // Default to 4x SNES resolution
    this.preRenderFrames = opts.preRenderFrames || 0; // Default to real-time rendering

    // Initialize Three.js
    this.initThreeJS();

    // Preload shaders if specified
    if (opts.preloadShaders) {
      preloadShaders(opts.preloadShaders);
    }

    // Load initial shader if specified
    if (opts.initialShader) {
      this.loadShader(opts.initialShader);
    }
  }

  private initThreeJS() {
    // Setup pixel rendering scene (for SNES output)
    this.pixelScene = new THREE.Scene();
    this.pixelCamera = new THREE.OrthographicCamera(
      -SNES_WIDTH / 2,
      SNES_WIDTH / 2,
      SNES_HEIGHT / 2,
      -SNES_HEIGHT / 2,
      0.1,
      1000,
    );
    this.pixelCamera.position.z = 10;

    // Create data texture for pixel rendering
    this.pixelData = new Uint8Array(SNES_WIDTH * SNES_HEIGHT * 4);
    this.pixelTexture = new THREE.DataTexture(
      this.pixelData,
      SNES_WIDTH,
      SNES_HEIGHT,
      THREE.RGBAFormat,
    );
    this.pixelTexture.colorSpace = THREE.SRGBColorSpace;
    this.pixelTexture.generateMipmaps = false;
    this.pixelTexture.minFilter = THREE.NearestFilter;
    this.pixelTexture.magFilter = THREE.NearestFilter;
    this.pixelTexture.needsUpdate = true;

    // Create render target for pixel rendering
    this.pixelRenderTarget = new THREE.WebGLRenderTarget(
      SNES_WIDTH,
      SNES_HEIGHT,
      {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        format: THREE.RGBAFormat,
        colorSpace: THREE.SRGBColorSpace,
        type: THREE.UnsignedByteType,
      },
    );

    // Create pixel mesh
    const pixelGeometry = new THREE.PlaneGeometry(SNES_WIDTH, SNES_HEIGHT);
    const pixelMaterial = new THREE.MeshBasicMaterial({
      map: this.pixelTexture,
      transparent: true,
      premultipliedAlpha: false
    });
    this.pixelMesh = new THREE.Mesh(pixelGeometry, pixelMaterial);
    this.pixelScene.add(this.pixelMesh);

    // Setup main scene (for CRT effect)
    this.scene = new THREE.Scene();

    // Output resolution (scaled up from SNES)
    const outputWidth = SNES_WIDTH * this.renderScale;
    const outputHeight = SNES_HEIGHT * this.renderScale;

    this.camera = new THREE.OrthographicCamera(
      -outputWidth / 2,
      outputWidth / 2,
      outputHeight / 2,
      -outputHeight / 2,
      0.1,
      1000,
    );
    this.camera.position.z = 10;

    // Create main renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      preserveDrawingBuffer: true,
      alpha: true,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setSize(outputWidth, outputHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.containerElement.appendChild(this.renderer.domElement);

    // Setup render target for post-processing
    this.renderTarget = new THREE.WebGLRenderTarget(outputWidth, outputHeight, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
    });

    // Create display mesh with the pixel texture
    const displayGeometry = new THREE.PlaneGeometry(outputWidth, outputHeight);
    const displayMaterial = new THREE.MeshBasicMaterial({
      map: this.pixelRenderTarget.texture,
      transparent: true,
      premultipliedAlpha: false,
    });
    this.displayMesh = new THREE.Mesh(displayGeometry, displayMaterial);
    this.scene.add(this.displayMesh);

    // Setup effect composer for post-processing
    this.composer = new EffectComposer(this.renderer, this.renderTarget);
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    // Add gamma correction as final pass
    const gammaCorrectionPass = new ShaderPass(GammaCorrectionShader);
    this.composer.addPass(gammaCorrectionPass);

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

  async loadShader(shaderType: ShaderType) {
    if (shaderType === "none") {
      this.disableShader();
      return;
    }

    if (this.shaderPasses.has(shaderType)) {
      this.enableShader(shaderType);
      return;
    }

    try {
      // Load the shader using the shader loader
      const shaderDefinition = await loadShader(shaderType);
      if (!shaderDefinition) {
        throw new Error(`Failed to load shader: ${shaderType}`);
      }

      // Configure shader uniforms
      if (shaderDefinition.uniforms.resolution) {
        shaderDefinition.uniforms.resolution.value = new THREE.Vector2(
          SNES_WIDTH * this.renderScale,
          SNES_HEIGHT * this.renderScale,
        );
      }

      // Create shader pass
      const shaderPass = new ShaderPass(shaderDefinition);
      this.shaderPasses.set(shaderType, shaderPass);
      this.enableShader(shaderType);
    } catch (error) {
      console.error(`Failed to load shader: ${shaderType}`, error);
    }
  }

  private enableShader(shaderType: ShaderType) {
    // Remove current shader if any
    this.disableShader();

    // Get the shader pass
    const shaderPass = this.shaderPasses.get(shaderType);
    if (!shaderPass) return;

    // Add the shader pass before the gamma correction pass
    this.composer.passes.splice(this.composer.passes.length - 1, 0, shaderPass);
    this.currentShader = shaderType;
    this.shaderLoaded = true;
  }

  private disableShader() {
    if (this.currentShader === "none") return;

    // Remove all shader passes except the first (render pass) and last (gamma correction)
    if (this.composer.passes.length > 2) {
      this.composer.passes.splice(1, this.composer.passes.length - 2);
    }

    this.currentShader = "none";
  }

  private renderSNESFrame(tick: number) {
    for (let i = 0; i < this.layers.length; ++i) {
      this.pixelData.set(
        this.layers[i].overlayFrame(
          this.pixelData,
          this.aspectRatio,
          tick,
          this.alpha[i],
          i === 0,
        ),
      );
    }

    this.pixelTexture.needsUpdate = true;

    // Render the pixel scene to the pixel render target
    this.renderer.setRenderTarget(this.pixelRenderTarget);
    this.renderer.render(this.pixelScene, this.pixelCamera);
    this.renderer.setRenderTarget(null);
  }

  private captureFrame(): THREE.Texture {
    // Render the current frame to the pixel render target
    this.renderer.setRenderTarget(this.pixelRenderTarget);
    this.renderer.render(this.pixelScene, this.pixelCamera);

    // Create a new texture from the render target
    const texture = this.pixelRenderTarget.texture.clone();

    // Reset render target
    this.renderer.setRenderTarget(null);

    return texture;
  }

  private preRenderAnimation() {
    this.isPreRendering = true;
    this.preRenderedFrames = [];
    this.totalFrameCount = 0;

    // Calculate how many frames to pre-render
    const frameCount = this.preRenderFrames || Math.ceil(this.fps * 10); // Default to 10 seconds of animation

    console.log(`Pre-rendering ${frameCount} frames...`);

    // Pre-render each frame
    for (let i = 0; i < frameCount; i++) {
      const tick = i * this.frameSkip;
      this.renderSNESFrame(tick);
      const texture = this.captureFrame();
      this.preRenderedFrames.push(texture);
      this.totalFrameCount++;
    }

    console.log(`Pre-rendered ${this.totalFrameCount} frames`);
    this.isPreRendering = false;
    this.isAnimationLooping = true;
  }

  private drawPreRenderedFrame() {
    if (this.preRenderedFrames.length === 0) return;

    // Get the current frame
    const frameTexture = this.preRenderedFrames[this.currentFrameIndex];

    // Update the display mesh with the current frame
    (this.displayMesh.material as THREE.MeshBasicMaterial).map = frameTexture;

    // Increment frame index
    this.currentFrameIndex =
      (this.currentFrameIndex + 1) % this.totalFrameCount;
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

        if (this.isAnimationLooping) {
          // Draw pre-rendered frame
          this.drawPreRenderedFrame();
        } else {
          // Render frame in real-time
          this.renderSNESFrame(this.tick);
          this.tick += this.frameSkip;
        }

        // Apply CRT shader effect
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

    this.renderer.setSize(outputWidth, outputHeight);
    this.renderTarget.setSize(outputWidth, outputHeight);
    this.composer.setSize(outputWidth, outputHeight);

    // Update camera
    this.camera.left = -outputWidth / 2;
    this.camera.right = outputWidth / 2;
    this.camera.top = outputHeight / 2;
    this.camera.bottom = -outputHeight / 2;
    this.camera.updateProjectionMatrix();

    // Update display mesh
    this.displayMesh.geometry = new THREE.PlaneGeometry(
      outputWidth,
      outputHeight,
    );

    // Update shader uniforms if applicable
    this.shaderPasses.forEach((pass, type) => {
      if (pass.uniforms.resolution) {
        pass.uniforms.resolution.value = new THREE.Vector2(
          outputWidth,
          outputHeight,
        );
      }
    });

    this.updateAspectRatio();
  }

  public resize() {
    this.updateAspectRatio();
  }

  // Shader parameter adjustment methods

  public setShaderParams(params: Record<string, number>) {
    if (this.currentShader === "none") return;

    const shaderPass = this.shaderPasses.get(this.currentShader);
    if (!shaderPass) return;

    // Update shader uniforms
    Object.entries(params).forEach(([key, value]) => {
      if (shaderPass.uniforms[key] !== undefined) {
        shaderPass.uniforms[key].value = value;
      }
    });
  }

  public getShaderParams(): Record<string, number> {
    if (this.currentShader === "none") return {};

    const shaderPass = this.shaderPasses.get(this.currentShader);
    if (!shaderPass) return {};

    // Get shader uniforms
    const params: Record<string, number> = {};

    Object.entries(shaderPass.uniforms).forEach(([key, uniform]) => {
      // Skip uniforms that are not numeric
      if (typeof uniform.value === "number") {
        params[key] = uniform.value;
      }
    });

    return params;
  }
}
