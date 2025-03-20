// shaderLoader.ts - Utility for loading CRT shaders

import type { ShaderType } from "$lib/types";

// Cache for loaded shaders
const shaderCache: Map<ShaderType, any> = new Map();

/**
 * Load a shader by type
 * @param shaderType The type of shader to load
 * @returns The shader object
 */
export async function loadShader(shaderType: ShaderType): Promise<any> {
  // Return null for 'none' shader
  if (shaderType === 'none') {
    return null;
  }
  
  // Check if shader is already cached
  if (shaderCache.has(shaderType)) {
    return shaderCache.get(shaderType);
  }
  
  try {
    // Get the shader path
    const shaderPath = `./shaders/${shaderType}.js`;
    
    // Dynamically import the shader
    const shaderModule = await import(/* @vite-ignore */ shaderPath);
    const shader = shaderModule.default;
    
    // Cache the shader
    shaderCache.set(shaderType, shader);
    
    return shader;
  } catch (error) {
    console.error(`Failed to load shader: ${shaderType}`, error);
    return null;
  }
}

/**
 * Preload a set of shaders
 * @param shaderTypes Array of shader types to preload
 */
export async function preloadShaders(shaderTypes: ShaderType[]): Promise<void> {
  await Promise.all(shaderTypes.map(type => loadShader(type)));
}
