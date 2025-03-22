/*
    zfast_crt_standard - A simple, fast CRT shader.

    Copyright (C) 2017 Greg Hogan (SoltanGris42)

    This program is free software; you can redistribute it and/or modify it
    under the terms of the GNU General Public License as published by the Free
    Software Foundation; either version 2 of the License, or (at your option)
    any later version.
*/
uniform sampler2D tDiffuse;
uniform vec2 resolution;
uniform vec2 sourceResolution;
uniform float pixelSize;

uniform float BLURSCALEX;
uniform float LOWLUMSCAN;
uniform float HILUMSCAN;
uniform float BRIGHTBOOST;
uniform float MASK_DARK;
uniform float MASK_FADE;

varying vec2 vUv;
varying float maskFade;
varying vec2 invDims;

#define FINEMASK

// vTexCoord -> vUv
// SourceSize -> sourceResolution
// OutputSize -> resolution
// TextureSize -> sourceResolution
// ratio = pixelSize

void main() {
	//This is just like "Quilez Scaling" but sharper
    vec2 p = vUv * sourceResolution;
    vec2 i = floor(p) + 0.50;
    vec2 f = p - i;
    p = (i + 4.0 * f * f * f) * invDims;
    p.x = mix(p.x, vUv.x, BLURSCALEX);

    vec3 colour = texture2D(tDiffuse, p).rgb;

    float Y = f.y * f.y;
    float YY = Y * Y;

    #if defined(FINEMASK)
    float whichmask = floor(vUv.x * resolution.x) * -0.5;
    float mask = 1.0 + float(fract(whichmask) < 0.5) * -MASK_DARK;
    #else
    float whichmask = floor(vUv.x * resolution.x) * -0.3333;
    float mask = 1.0 + float(fract(whichmask) < 0.3333) * -MASK_DARK;
    #endif

    float scanLineWeight = (BRIGHTBOOST - LOWLUMSCAN * (Y - 2.05 * YY));
    float scanLineWeightB = 1.0 - HILUMSCAN * (YY - 2.8 * YY * Y);

    gl_FragColor = vec4(colour.rgb * mix(scanLineWeight * mask, scanLineWeightB, dot(colour.rgb, vec3(maskFade))), 1.0);
}
