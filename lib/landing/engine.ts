import { IMAGE_W } from './content'
import type { FrameState } from './timeline'

/**
 * Moteur de glyphes en WebGL2 instancié. Une instance par glyphe ; toute
 * l'interpolation se fait dans le vertex shader à partir d'une seule
 * progression, sans calcul CPU par image.
 */
const VS_GLYPH = `#version 300 es
precision highp float;
layout(location=0) in vec2 aQuad;
layout(location=1) in vec4 a0;
layout(location=2) in vec4 a1;
layout(location=3) in vec4 a2;
layout(location=4) in vec4 a3;
uniform vec2 uRes;uniform float uP;uniform float uT;uniform float uSrcQuad;uniform float uCell;uniform vec2 uGrid;uniform float uPool;
out vec2 vUv;out vec2 vLocal;out vec3 vCol;out float vAlpha;out float vSq;
float ease(float t){return t<.5?4.*t*t*t:1.-pow(-2.*t+2.,3.)/2.;}
float h1(float n){return fract(sin(n)*43758.5453);}
void main(){
  float rnd=a1.z,dup=a1.w,line=a2.w,radial=a3.w;
  float send=smoothstep(line*.085,line*.085+.025,uP);
  float t=clamp((uP-.1-line*.14-rnd*.03)/.15,0.,1.);
  float m=ease(t);
  vec2 from=a0.xy-vec2(0.,10.*send*(1.-m));
  vec2 to=a0.zw;
  vec2 d=to-from;
  vec2 nrm=normalize(vec2(-d.y,d.x)+1e-4);
  float bend=sin(from.y*.011+rnd*6.283)*.6+cos(from.x*.007+rnd*3.1)*.4;
  vec2 mid=mix(from,to,.42)+nrm*bend*mix(12.,48.,rnd)+vec2(0.,-12.*rnd);
  vec2 pos=mix(mix(from,mid,m),mix(mid,to,m),m);
  float wave=smoothstep(0.,.05,uP-.32-radial*.09-rnd*.02);
  float sq=smoothstep(0.,.045,uP-.5-radial*.05-rnd*.02);
  float size=mix(uSrcQuad,uCell*1.3,m);
  size=mix(size,uCell,sq);
  vec2 px=pos+(aQuad-.5)*size;
  vec2 clip=px/uRes*2.-1.;
  gl_Position=vec4(clip.x,-clip.y,0.,1.);
  float ch=a1.x;
  if(t>.4&&t<.8&&rnd<.2) ch=floor(h1(floor(uT*14.)+rnd*311.)*uPool);
  if(wave>.5) ch=a1.y;
  vec2 cell=vec2(mod(ch,uGrid.x),floor(ch/uGrid.x));
  vUv=(cell+aQuad)/uGrid;
  vLocal=aQuad;
  vec3 ink=mix(a2.rgb,vec3(1.),send*(1.-t)*.4);
  vCol=mix(ink,a3.rgb,wave);
  vAlpha=dup>.5?smoothstep(.3,.75,t):1.;
  vSq=sq;
}`
const FS_GLYPH = `#version 300 es
precision highp float;
in vec2 vUv;in vec2 vLocal;in vec3 vCol;in float vAlpha;in float vSq;
uniform sampler2D uAtlas;uniform float uGap;uniform float uFade;uniform float uCellPx;
out vec4 o;
void main(){
  float g=texture(uAtlas,vUv).a;
  vec2 dp=min(vLocal,1.-vLocal)*uCellPx;
  float e=smoothstep(uGap*.5-.5,uGap*.5+.5,min(dp.x,dp.y));
  float a=mix(g,e,vSq)*vAlpha*uFade;
  o=vec4(vCol*a,a);
}`
const VS_IMG = `#version 300 es
precision highp float;
layout(location=0) in vec2 aQuad;
uniform vec2 uRes;uniform vec4 uRect;
out vec2 vLocal;
void main(){
  vec2 px=uRect.xy+aQuad*uRect.zw;
  vec2 clip=px/uRes*2.-1.;
  gl_Position=vec4(clip.x,-clip.y,0.,1.);
  vLocal=aQuad;
}`
const FS_IMG = `#version 300 es
precision highp float;
in vec2 vLocal;
uniform sampler2D uImg;uniform vec4 uRect;uniform vec2 uGridN;uniform float uGap;uniform float uAlpha;uniform float uLod;
out vec4 o;
void main(){
  vec2 uv=vLocal;
  float ia=16./9.,ra=uRect.z/uRect.w;
  if(ra>ia) uv.y=(uv.y-.5)*(ia/ra)+.5; else uv.x=(uv.x-.5)*(ra/ia)+.5;
  float a=uAlpha;
  float lod=0.;
  if(uGridN.x>0.){
    vec2 c=floor(uv*uGridN);vec2 f=fract(uv*uGridN);
    uv=(c+.5)/uGridN;
    vec2 dp=min(f,1.-f)*uRect.zw/uGridN;
    a*=smoothstep(uGap*.5-.5,uGap*.5+.5,min(dp.x,dp.y));
    lod=uLod;
  }
  vec3 col=textureLod(uImg,uv,lod).rgb;
  o=vec4(col*a,a);
}`

export interface GlyphParams {
  /** Taille du quad source, en px : celle du glyphe dans le `<pre>`. */
  srcQuad: number
  /** Côté d'une cellule de la grille, en px. */
  cell: number
}

export interface Engine {
  setAtlas(chars: [string, number][], poolSize: number, fontFamily: string): void
  image(key: string, source: TexImageSource): WebGLTexture
  setGlyphs(data: Float32Array, count: number, params: GlyphParams): void
  draw(state: FrameState & { tex: WebGLTexture | null }): void
}

type Program = { p: WebGLProgram; u: Record<string, WebGLUniformLocation | null> }

/**
 * `null` sans WebGL2 : la page reste sur la séquence fixe. Le contexte n'est
 * jamais perdu volontairement : React remonte l'effet sur le même canvas, qui
 * rendrait alors un contexte mort.
 */
export function createEngine(canvas: HTMLCanvasElement): Engine | null {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: true })
  if (!gl) return null

  const shader = (type: number, source: string) => {
    const s = gl.createShader(type)!
    gl.shaderSource(s, source)
    gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader')
    return s
  }
  const program = (vs: string, fs: string): Program => {
    const p = gl.createProgram()!
    gl.attachShader(p, shader(gl.VERTEX_SHADER, vs))
    gl.attachShader(p, shader(gl.FRAGMENT_SHADER, fs))
    gl.linkProgram(p)
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'program')
    const u: Program['u'] = {}
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) as number
    for (let i = 0; i < n; i++) {
      const name = gl.getActiveUniform(p, i)!.name
      u[name] = gl.getUniformLocation(p, name)
    }
    return { p, u }
  }

  const G = program(VS_GLYPH, FS_GLYPH)
  const I = program(VS_IMG, FS_IMG)
  const quad = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, quad)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW)

  const vaoG = gl.createVertexArray()
  gl.bindVertexArray(vaoG)
  gl.bindBuffer(gl.ARRAY_BUFFER, quad)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
  const instances = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, instances)
  for (let a = 0; a < 4; a++) {
    gl.enableVertexAttribArray(1 + a)
    gl.vertexAttribPointer(1 + a, 4, gl.FLOAT, false, 64, a * 16)
    gl.vertexAttribDivisor(1 + a, 1)
  }
  const vaoI = gl.createVertexArray()
  gl.bindVertexArray(vaoI)
  gl.bindBuffer(gl.ARRAY_BUFFER, quad)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
  gl.bindVertexArray(null)

  const upload = (source: TexImageSource) => {
    const t = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, t)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    gl.generateMipmap(gl.TEXTURE_2D)
    return t
  }

  const images = new Map<string, WebGLTexture>()
  let atlas: WebGLTexture | null = null
  let atlasGrid: [number, number] = [16, 1]
  let pool = 1
  let count = 0
  let params: GlyphParams = { srcQuad: 0, cell: 0 }

  return {
    /** Atlas de 64 px par case, corps de 46 px. */
    setAtlas(chars, poolSize, fontFamily) {
      const cols = 16
      const rows = Math.ceil(chars.length / cols)
      const c = document.createElement('canvas')
      c.width = cols * 64
      c.height = rows * 64
      const g = c.getContext('2d')!
      g.fillStyle = '#fff'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      chars.forEach(([ch, weight], i) => {
        g.font = `${weight} 46px ${fontFamily}`
        g.fillText(ch, (i % cols) * 64 + 32, Math.floor(i / cols) * 64 + 33)
      })
      if (atlas) gl.deleteTexture(atlas)
      atlas = upload(c)
      atlasGrid = [cols, rows]
      pool = poolSize
    },
    image(key, source) {
      let t = images.get(key)
      if (!t) {
        t = upload(source)
        images.set(key, t)
      }
      return t
    },
    setGlyphs(data, n, next) {
      gl.bindBuffer(gl.ARRAY_BUFFER, instances)
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
      count = n
      params = next
    },
    draw(s) {
      const dpr = Math.min(devicePixelRatio || 1, 2)
      const W = canvas.clientWidth
      const H = canvas.clientHeight
      const bw = Math.round(W * dpr)
      const bh = Math.round(H * dpr)
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw
        canvas.height = bh
      }
      gl.viewport(0, 0, bw, bh)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
      if (s.imgAlpha > 0 && s.tex) {
        gl.useProgram(I.p)
        gl.bindVertexArray(vaoI)
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, s.tex)
        gl.uniform1i(I.u.uImg, 0)
        gl.uniform2f(I.u.uRes, W, H)
        gl.uniform4f(I.u.uRect, s.rect.x, s.rect.y, s.rect.w, s.rect.h)
        gl.uniform2f(I.u.uGridN, s.gridN[0], s.gridN[1])
        gl.uniform1f(I.u.uGap, s.gap)
        gl.uniform1f(I.u.uAlpha, s.imgAlpha)
        gl.uniform1f(I.u.uLod, s.gridN[0] > 0 ? Math.log2(IMAGE_W / s.gridN[0]) : 0)
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      }
      if (s.glyphAlpha > 0 && count && atlas) {
        gl.useProgram(G.p)
        gl.bindVertexArray(vaoG)
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, atlas)
        gl.uniform1i(G.u.uAtlas, 0)
        gl.uniform2f(G.u.uRes, W, H)
        gl.uniform1f(G.u.uP, s.p)
        gl.uniform1f(G.u.uT, s.t)
        gl.uniform1f(G.u.uSrcQuad, params.srcQuad)
        gl.uniform1f(G.u.uCell, params.cell)
        gl.uniform2f(G.u.uGrid, atlasGrid[0], atlasGrid[1])
        gl.uniform1f(G.u.uPool, pool)
        gl.uniform1f(G.u.uGap, s.gapPx)
        gl.uniform1f(G.u.uCellPx, params.cell)
        gl.uniform1f(G.u.uFade, s.glyphAlpha)
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count)
      }
      gl.bindVertexArray(null)
    },
  }
}
