/*
    zfast_crt_standard - A simple, fast CRT shader.

    Copyright (C) 2017 Greg Hogan (SoltanGris42)

    This program is free software; you can redistribute it and/or modify it
    under the terms of the GNU General Public License as published by the Free
    Software Foundation; either version 2 of the License, or (at your option)
    any later version.
*/
varying vec2 vUv;
varying float maskFade;
varying vec2 invDims;
uniform vec2 sourceResolution;
uniform vec2 resolution;
uniform float MASK_FADE;

void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vUv = uv;
    maskFade = 0.3333 * MASK_FADE;
    invDims = 1.0 / sourceResolution;
}
