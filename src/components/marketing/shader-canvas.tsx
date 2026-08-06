"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";

const VERT = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

// Three-layer simplex-noise plasma in indigo/violet/lavender.
// Top-heavy mask so glow concentrates near the top of the section.
const FRAG = `
precision mediump float;
uniform float u_time;
uniform vec2 u_resolution;

vec3 m289v3(vec3 x) { return x - floor(x*(1.0/289.0))*289.0; }
vec2 m289v2(vec2 x) { return x - floor(x*(1.0/289.0))*289.0; }
vec3 perm(vec3 x) { return m289v3(((x*34.0)+1.0)*x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0,0.0) : vec2(0.0,1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = m289v2(i);
  vec3 p = perm(perm(i.y+vec3(0.0,i1.y,1.0))+i.x+vec3(0.0,i1.x,1.0));
  vec3 m = max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.0);
  m=m*m; m=m*m;
  vec3 x = 2.0*fract(p*C.www)-1.0;
  vec3 h = abs(x)-0.5;
  vec3 a0 = x-floor(x+0.5);
  m *= 1.79284291400159 - 0.85373472095314*(a0*a0+h*h);
  vec3 g;
  g.x  = a0.x*x0.x  + h.x*x0.y;
  g.yz = a0.yz*x12.xz + h.yz*x12.yw;
  return 130.0*dot(m,g);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float asp = u_resolution.x / u_resolution.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  float t = u_time * 0.11;

  float n1 = snoise(p*1.7 + vec2(t*0.55, t*0.22))*0.5+0.5;
  float n2 = snoise(p*3.0 + vec2(-t*0.32, t*0.43))*0.5+0.5;
  float n3 = snoise(p*5.3 + vec2(t*0.13, -t*0.51))*0.5+0.5;

  vec3 base   = vec3(0.031, 0.039, 0.071);  // #080a12
  vec3 indigo = vec3(0.310, 0.275, 0.898);  // #4f46e5
  vec3 violet = vec3(0.486, 0.227, 0.929);  // #7c3aed
  vec3 lav    = vec3(0.506, 0.549, 0.973);  // #818cf8

  // Stronger near top, dissolves into base near bottom
  float topMask = pow(clamp(1.0 - uv.y * 0.80, 0.0, 1.0), 1.4);

  vec3 col = base;
  col += indigo * (n1*n2) * 0.26 * topMask;
  col += violet * (n2*n3) * 0.18 * topMask;
  col += lav    * (n1*n3) * 0.11 * topMask * (1.0 - uv.y*0.35);

  // Radial vignette — darkens edges
  vec2 cv = vec2((uv.x-0.5)*asp, uv.y-0.5);
  float vig = 1.0 - smoothstep(0.38, 1.15, length(cv)*1.25);
  col = mix(base, col, vig*0.88+0.12);

  gl_FragColor = vec4(col, 1.0);
}
`;

interface ShaderCanvasProps {
  className?: string;
  /** Playback speed multiplier (default 1). */
  speed?: number;
}

export function ShaderCanvas({ className, speed = 1 }: ShaderCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl");
    if (!gl) return;

    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      return sh;
    };

    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const posLoc = gl.getAttribLocation(prog, "a_position");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(prog, "u_time");
    const uRes  = gl.getUniformLocation(prog, "u_resolution");

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio ?? 1, 2);
      canvas.width  = canvas.clientWidth  * dpr;
      canvas.height = canvas.clientHeight * dpr;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    let rafId: number;
    const t0 = performance.now();

    const draw = (now: number) => {
      gl.uniform1f(uTime, ((now - t0) / 1000) * speed);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (!prefersReduced) rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [prefersReduced, speed]);

  return <canvas ref={canvasRef} aria-hidden className={className} style={{ display: "block" }} />;
}
