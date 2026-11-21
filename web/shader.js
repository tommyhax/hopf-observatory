export const vertex = `#version 300 es
precision highp float;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2. - 1., 0, 1);
}`;
export const fragment = `#version 300 es
precision highp float;
precision highp int;
out vec4 outColor;
uniform vec2 uResolution;
uniform mat4 uP;
uniform float uC, uOpacity, uIOR;
uniform vec3 uEye, uRight, uUp, uForward;
uniform int uEnvironment, uMode, uBounces, uShell;
uniform float uShellLow, uShellHigh;
// uCount=0 selects the single-boundary interface used by numerical probes.
uniform int uCount;
uniform ivec3 uEnabled, uShells;
uniform vec3 uLevels, uLows, uHighs;
uniform vec4 uOptics[3]; // coating opacity, index, roughness, metallic
uniform vec3 uColors[3];
uniform float uEnvRotation, uExposure, uMapMaxLod, uRayBias;
uniform sampler2D uEnvironmentMap;
const float PI = 3.14159265359;
// Bernstein coefficients, ascending basis index. No spatial sampling.
struct Poly {
  vec4 a;
  float b;
};
float coeff(Poly p, int i) {
  return i == 4 ? p.b : p.a[i];
}
Poly derivative(Poly p) {
  return Poly(vec4(p.a.y - p.a.x, p.a.z - p.a.y, p.a.w - p.a.z, p.b - p.a.w), 0.);
}
float value(Poly p, int n, float x) {
  vec4 a = p.a;
  if (n == 4) {
    a = mix(a, vec4(a.yzw, p.b), x);
  }
  if (n >= 3) {
    a.xyz = mix(a.xyz, a.yzw, x);
  }
  if (n >= 2) {
    a.xy = mix(a.xy, a.yz, x);
  }
  if (n >= 1) {
    a.x = mix(a.x, a.y, x);
  }
  return a.x;
}
float errorBound(Poly p, int n, float x) {
  return 2.5e-7 * value(Poly(abs(p.a), abs(p.b)), n, x) + 2e-9;
}
void addRoot(inout vec4 roots, inout int count, float x) {
  if (count > 0 && (roots[count - 1] == x ||
                    abs(roots[count - 1] - x) < 3e-7 * max(abs(x), abs(roots[count - 1]))))
    return;
  if (count < 4) {
    roots[count] = x;
    count++;
  }
}
// A polynomial is monotone between adjacent derivative roots. Isolate one
// sign-changing root per interval; explicitly retain stationary double roots.
void isolate(Poly p, int n, vec4 critical, int nc, out vec4 roots, out int count) {
  roots = vec4(0);
  count = 0;
  float scale = 0.;
  for (int i = 0; i < 5; i++) {
    if (i <= n)
      scale = max(scale, abs(coeff(p, i)));
  }
  if (scale == 0.)
    return;
  p.a /= scale;
  p.b /= scale;
  float lo = 0., fl = value(p, n, 0.);
  for (int j = 0; j < 5; j++) {
    if (j > nc)
      break;
    float hi = j < nc ? critical[j] : 1.;
    float fh = value(p, n, hi);
    float prev = j > 0 ? value(p, n, j > 1 ? critical[j - 2] : 0.) : fl;
    bool crossesLeft = (prev < 0. && fl > 0.) || (prev > 0. && fl < 0.);
    bool crossesRight = (fl < 0. && fh > 0.) || (fl > 0. && fh < 0.);
    if ((fl == 0. || (lo > 0. && lo < 1. && abs(fl) <= errorBound(p, n, lo))) && !crossesLeft &&
        !crossesRight)
      addRoot(roots, count, lo);
    if ((fl < 0. && fh > 0.) || (fl > 0. && fh < 0.)) {
      float a = lo, b = hi, fa = fl, fb = fh;
      for (int k = 0; k < 25; k++) {
        float m = .5 * (a + b), fm = value(p, n, m);
        if ((fa < 0. && fm > 0.) || (fa > 0. && fm < 0.)) {
          b = m;
          fb = fm;
        } else {
          a = m;
          fa = fm;
        }
        if (fm == 0.) {
          a = m;
          b = m;
          fb = fm;
          break;
        }
      }
      // Interpolate the final sign bracket. Unlike its midpoint, this keeps
      // relative accuracy for a root very close to the endpoint zero.
      float x = fa == 0. ? a : fb == 0. ? b : a + (b - a) * (fa / (fa - fb));
      addRoot(roots, count, clamp(x, a, b));
    }
    if (j == nc && fh == 0.)
      addRoot(roots, count, hi);
    lo = hi;
    fl = fh;
  }
}
void quarticRoots(Poly p, out vec4 roots, out int count) {
  Poly d = derivative(p), dd = derivative(d), ddd = derivative(dd);
  vec4 linear = vec4(0), quadratic, cubic;
  int nl = 0, nq, nc;
  float den = ddd.a.x - ddd.a.y;
  if (den != 0.) {
    float x = ddd.a.x / den;
    if (x > 0. && x < 1.) {
      linear[0] = x;
      nl = 1;
    }
  }
  isolate(dd, 2, linear, nl, quadratic, nq);
  // Endpoints are handled by each stage, not as interior partition points.
  vec4 q = vec4(0);
  int qn = 0;
  for (int i = 0; i < 4; i++) {
    if (i < nq && quadratic[i] > 0. && quadratic[i] < 1.) {
      q[qn] = quadratic[i];
      qn++;
    }
  }
  isolate(d, 3, q, qn, cubic, nc);
  vec4 c = vec4(0);
  int cn = 0;
  for (int i = 0; i < 4; i++) {
    if (i < nc && cubic[i] > 0. && cubic[i] < 1.) {
      c[cn] = cubic[i];
      cn++;
    }
  }
  isolate(p, 4, c, cn, roots, count);
}
float form(vec4 a, vec4 b, float level) {
  return dot(a, (uP - mat4(level)) * b);
}
// Small shells need smaller origin offsets AND a smaller positive-root
// cutoff. Widely separated boundaries use the upper bias limit.
float rayBiasScale() {
  if (uRayBias > 0.)
    return uRayBias;
  // Single-shell probes derive their bias from the two supplied levels.
  float gap =
      uShell == 1
          ? abs(acos(sqrt(clamp(uShellLow, 0., 1.))) - acos(sqrt(clamp(uShellHigh, 0., 1.))))
          : 1.;
  return clamp(.05 * gap, 1e-6, 4e-4);
}
float rayEpsilon(vec3 p) {
  return rayBiasScale() * max(1., length(p));
}
// Cover each centered half-ray with two well-scaled coordinates:
// near x=lambda/L in [0,1]; far x=L/lambda in (0,1]. Infinity is far x=0.
// Divide the homogeneous numerator by L^2 before forming its quartic.
void chartVectors(vec3 center, vec3 direction, float L, bool farChart, out vec4 a, out vec4 b,
                  out vec4 c) {
  float invL = 1. / L;
  vec3 scaled = center * invL;
  vec4 base = vec4(2. * scaled * invL, dot(scaled, scaled) - invL * invL);
  b = vec4(2. * direction * invL, 2. * dot(scaled, direction));
  vec4 top = vec4(0, 0, 0, dot(direction, direction));
  a = farChart ? top : base;
  c = farChart ? base : top;
}
Poly chartPoly(vec4 a, vec4 b, vec4 c, float level) {
  // a+b*x+c*x^2 in quadratic Bernstein form, then square the form.
  vec4 middle = a + .5 * b, end = a + b + c;
  return Poly(vec4(form(a, a, level), form(a, middle, level),
                   (form(a, end, level) + 2. * form(middle, middle, level)) / 3.,
                   form(middle, end, level)),
              form(end, end, level));
}
float refineChart(vec4 a, vec4 b, vec4 c, float x, float level) {
  mat4 A = uP - mat4(level);
  for (int i = 0; i < 4; i++) {
    vec4 w = a + x * (b + x * c), aw = A * w;
    float f = dot(w, aw), df = 2. * dot(b + 2. * x * c, aw);
    if (df == 0.)
      break;
    float next = x - f / df;
    if (next < 0. || next > 1. || abs(next - x) > .05 * max(x, 1e-6))
      break;
    x = next;
  }
  return x;
}
float chartResidual(vec4 a, vec4 b, vec4 c, float x, bool farChart, float level) {
  vec4 w = a + x * (b + x * c), aw = (uP - mat4(level)) * w;
  mat4 A = uP - mat4(level);
  mat4 absoluteA = mat4(abs(A[0]), abs(A[1]), abs(A[2]), abs(A[3]));
  float magnitude = dot(abs(w), absoluteA * abs(w));
  float df = 2. * dot(b + 2. * x * c, aw);
  // Allow coordinate rounding as well as arithmetic in the form. At a far
  // root, x*df measures RELATIVE distance error; using a constant here would
  // again admit large distance errors as x approaches zero.
  float scale = magnitude + abs(df) * (farChart ? x : 1.);
  return scale == 0. ? 0. : abs(dot(w, aw)) / scale;
}
float chartIntersection(vec3 center, vec3 direction, float L, float k, float sign, bool farChart,
                        float minS, float level) {
  vec4 a, b, c, roots;
  chartVectors(center, direction, L, farChart, a, b, c);
  Poly polynomial = chartPoly(a, b, c, level);
  // Bernstein convex hull: a strictly one-signed coefficient set has no roots.
  float minimum = min(min(polynomial.a.x, polynomial.a.y), min(polynomial.a.z, polynomial.a.w));
  float maximum = max(max(polynomial.a.x, polynomial.a.y), max(polynomial.a.z, polynomial.a.w));
  if (min(minimum, polynomial.b) > 0. || max(maximum, polynomial.b) < 0.)
    return -1.;
  int count;
  quarticRoots(polynomial, roots, count);
  float best = -1.;
  for (int i = 0; i < 4; i++) {
    if (i >= count)
      break;
    float x = refineChart(a, b, c, roots[i], level);
    if (farChart && x <= 0.)
      continue;
    float distance = farChart ? L / x : L * x;
    float s = sign * distance - k;
    // A relative homogeneous residual remains informative when all field
    // terms vanish toward the pole; a fixed absolute residual does not.
    if (s > minS && !isinf(s) && !isnan(s) && chartResidual(a, b, c, x, farChart, level) < 2e-6 &&
        (best < 0. || s < best))
      best = s;
  }
  return best;
}
float intersection(vec3 o, vec3 d, float level) {
  float k = dot(o, d);
  vec3 center = o - k * d;
  float L = max(1., length(center)), minS = .5 * rayEpsilon(o), hit;
  if (k < 0.) {
    // The negative half is traversed from far to near, before the positive half.
    hit = chartIntersection(center, -d, L, k, -1., true, minS, level);
    if (hit >= 0.)
      return hit;
    hit = chartIntersection(center, -d, L, k, -1., false, minS, level);
    if (hit >= 0.)
      return hit;
  }
  hit = chartIntersection(center, d, L, k, 1., false, minS, level);
  if (hit >= 0.)
    return hit;
  return chartIntersection(center, d, L, k, 1., true, minS, level);
}
float side(vec3 p, float level) {
  // Normalized by (1+r²)² to avoid overflow far from the origin.
  float r = dot(p, p);
  vec4 q = vec4(2. * p, r - 1.) / (1. + r);
  return dot(q, (uP - mat4(level)) * q);
}
vec3 normalAt(vec3 p, float level) {
  // Analytic gradient with a positive (1+r²) scale divided out.
  float r = dot(p, p);
  vec4 q = vec4(2. * p, r - 1.) / (1. + r), aq = (uP - mat4(level)) * q;
  return normalize(aq.xyz + p * aq.w);
}
// One boundary for a solid torus, two independent quartics for a shell.
// The shell is cLow < q^T P q < cHigh. Its two outward normals have
// opposite signs relative to the gradient of q^T P q.
bool inMaterial(vec3 p) {
  return uShell == 1 ? side(p, uShellLow) > 0. && side(p, uShellHigh) < 0. : side(p, uC) > 0.;
}
float boundaryHit(vec3 o, vec3 d, out float level, out float normalSign) {
  level = uC;
  normalSign = -1.;
  if (uShell == 0)
    return intersection(o, d, level);
  float lowHit = intersection(o, d, uShellLow), highHit = intersection(o, d, uShellHigh);
  if (lowHit >= 0. && (highHit < 0. || lowHit <= highHit)) {
    level = uShellLow;
    normalSign = -1.;
    return lowHit;
  }
  level = uShellHigh;
  normalSign = 1.;
  return highHit;
}
int objectCount() {
  return uCount == 0 ? 1 : uCount;
}
bool enabled(int i) {
  return uCount == 0 || uEnabled[i] == 1;
}
bool isShell(int i) {
  return uCount == 0 ? uShell == 1 : uShells[i] == 1;
}
float objectLevel(int i) {
  return uCount == 0 ? uC : uLevels[i];
}
float lowLevel(int i) {
  return uCount == 0 ? uShellLow : uLows[i];
}
float highLevel(int i) {
  return uCount == 0 ? uShellHigh : uHighs[i];
}
vec4 optics(int i) {
  return i < 0 ? vec4(0, 1, 0, 0) : uCount == 0 ? vec4(uOpacity, uIOR, 0, 0) : uOptics[i];
}
vec3 colorAt(int i) {
  return uCount == 0 ? vec3(.075, .57, .56) : uColors[i];
}
int materialMask(vec3 p) {
  int mask = 0;
  for (int i = 0; i < 3; i++) {
    if (i >= objectCount())
      break;
    if (!enabled(i))
      continue;
    if (isShell(i) ? side(p, lowLevel(i)) > 0. && side(p, highLevel(i)) < 0.
                   : side(p, objectLevel(i)) > 0.)
      mask |= 1 << i;
  }
  return mask;
}
int mediumFor(int mask) {
  int id = -1;
  float width = 2.;
  for (int i = 0; i < 3; i++) {
    if (i >= objectCount())
      break;
    if ((mask & (1 << i)) == 0)
      continue;
    float w = isShell(i) ? highLevel(i) - lowLevel(i) : 1. - objectLevel(i);
    if (w <= width) {
      width = w;
      id = i;
    }
  }
  return id;
}
int interfaceMaterial(int before, int after) {
  return before < 0 ? after : after < 0 ? before : mediumFor((1 << before) | (1 << after));
}
bool aboveBoundary(float level, float boundary, bool increasing) {
  return abs(level - boundary) < 2e-7 ? increasing : level > boundary;
}
// Resolve simultaneous/coincident boundary crossings in level space, without
// relying on a positional offset that could leap over another thin wall.
int maskAcross(float level, bool increasing) {
  int mask = 0;
  for (int i = 0; i < 3; i++) {
    if (i >= objectCount())
      break;
    if (!enabled(i))
      continue;
    bool inside = isShell(i) ? aboveBoundary(level, lowLevel(i), increasing) &&
                                   !aboveBoundary(level, highLevel(i), increasing)
                             : aboveBoundary(level, objectLevel(i), increasing);
    if (inside)
      mask |= 1 << i;
  }
  return mask;
}
float sceneHit(vec3 o, vec3 d, out float level, out float normalSign, out int id) {
  float best = -1.;
  level = 0.;
  normalSign = -1.;
  id = -1;
  for (int i = 0; i < 3; i++) {
    if (i >= objectCount())
      break;
    if (!enabled(i))
      continue;
    float lo = isShell(i) ? lowLevel(i) : objectLevel(i), s = intersection(o, d, lo);
    if (s >= 0. && (best < 0. || s < best)) {
      best = s;
      level = lo;
      normalSign = -1.;
      id = i;
    }
    if (isShell(i)) {
      s = intersection(o, d, highLevel(i));
      if (s >= 0. && (best < 0. || s < best)) {
        best = s;
        level = highLevel(i);
        normalSign = 1.;
        id = i;
      }
    }
  }
  return best;
}
float line(float x, float width) {
  return 1. - smoothstep(width, width * 2., abs(fract(x + .5) - .5));
}
vec3 rotateY(vec3 d, float a) {
  float c = cos(a), s = sin(a);
  return vec3(c * d.x + s * d.z, d.y, -s * d.x + c * d.z);
}
vec3 environmentRaw(vec3 d, float lod) {
  d = rotateY(d, uEnvRotation);
  float az = atan(d.z, d.x) / PI, el = asin(clamp(d.y, -1., 1.)) / PI;
  if (uEnvironment == 6) {
    vec2 uv = vec2(fract(az * .5 + .5), .5 - el);
    return pow(max(textureLod(uEnvironmentMap, uv, lod).rgb, vec3(0)), vec3(2.2));
  }
  float h = smoothstep(-.45, .75, d.y);
  vec3 col = mix(vec3(.012, .026, .038), vec3(.055, .09, .13), h);
  if (uEnvironment == 1)
    col = mix(vec3(.18, .22, .26), vec3(.5, .58, .62), h);
  float grid = max(line(az * 12., .008), line(el * 12., .008));
  col += vec3(.09, .16, .19) * grid * .30;
  col += vec3(.20, .34, .37) * exp(-abs(d.y + .12) * 38.) * .28;
  if (d.y < -.13) {
    vec2 p = d.xz / (-d.y + .08);
    float checker = mod(floor(p.x * 1.8) + floor(p.y * 1.8), 2.);
    col += mix(vec3(.015, .026, .033), vec3(.07, .10, .115), checker) * smoothstep(.04, .45, -d.y);
  }
  float warm = pow(max(0., dot(d, normalize(vec3(-.8, .3, -1.)))), 64.);
  float cool = pow(max(0., dot(d, normalize(vec3(1., .45, .3)))), 85.);
  col += vec3(3.6, 2.3, .9) * warm + vec3(.4, 1.8, 2.8) * cool;
  col += vec3(.8, 1.55, 1.65) * exp(-pow((az - .40) * 95., 2.)) * smoothstep(-.3, .0, d.y) *
         (1. - smoothstep(.65, .85, d.y));
  if (uEnvironment == 2)
    col = vec3(.035, .047, .06) + vec3(.22, .29, .35) * grid + vec3(1.7, .72, .18) * warm +
          vec3(.12, .7, 1.4) * cool;
  if (uEnvironment == 3) {
    col = mix(vec3(.035), vec3(.17, .19, .22), h);
    float ceiling = smoothstep(.55, .65, d.y);
    float box1 =
        (1. - smoothstep(.20, .23, abs(az + .32))) * (1. - smoothstep(.25, .28, abs(el - .12)));
    float box2 =
        (1. - smoothstep(.07, .09, abs(az - .40))) * (1. - smoothstep(.32, .35, abs(el - .06)));
    col += vec3(2.8, 2.9, 3.1) * box1 + vec3(5., 3.9, 2.7) * box2 + vec3(.65, .78, 1.) * ceiling;
  }
  if (uEnvironment == 4) {
    col = mix(vec3(.5, .16, .065), vec3(.09, .22, .44), smoothstep(-.03, .6, d.y));
    if (d.y < 0.)
      col = mix(vec3(.018, .028, .04), vec3(.16, .095, .06), exp(d.y * 12.));
    vec3 sun = normalize(vec3(-1., .10, -.35));
    col += vec3(8., 4.3, 1.5) * pow(max(0., dot(d, sun)), 900.);
    col += vec3(.32, .13, .06) * pow(max(0., dot(d, sun)), 12.);
  }
  if (uEnvironment == 5) {
    col = vec3(.07, .09, .12);
    float wall = pow(max(0., 1. - abs(d.y)), 3.);
    float windows = line(az * 8., .12) * (1. - smoothstep(.18, .25, abs(el - .10)));
    col += vec3(.7, .9, 1.2) * windows * wall;
    col += vec3(.35, .16, .07) * line(az * 4. + .2, .035) * wall;
    if (d.y > .6)
      col += vec3(.4, .5, .65);
    if (d.y < -.1) {
      vec2 p = d.xz / max(.1, -d.y);
      col += vec3(.2) * mod(floor(p.x) + floor(p.y), 2.);
    }
  }
  return col;
}
vec3 environment(vec3 d) {
  return exp2(uExposure) * environmentRaw(d, 0.);
}
vec3 roughEnvironment(vec3 d, float roughness) {
  if (roughness < .015)
    return environment(d);
  if (uEnvironment == 6)
    return exp2(uExposure) * environmentRaw(d, roughness * uMapMaxLod);
  vec3 a = normalize(cross(d, abs(d.y) < .9 ? vec3(0, 1, 0) : vec3(1, 0, 0))), b = cross(d, a);
  float spread = roughness * roughness * .65;
  return exp2(uExposure) *
         (.4 * environmentRaw(d, 0.) + .15 * (environmentRaw(normalize(d + spread * a), 0.) +
                                              environmentRaw(normalize(d - spread * a), 0.) +
                                              environmentRaw(normalize(d + spread * b), 0.) +
                                              environmentRaw(normalize(d - spread * b), 0.)));
}
float fresnel(float ci, float n1, float n2) {
  float st2 = (n1 / n2) * (n1 / n2) * (1. - ci * ci);
  if (st2 >= 1.)
    return 1.;
  float ct = sqrt(max(0., 1. - st2));
  float rs = (n1 * ci - n2 * ct) / max(1e-7, n1 * ci + n2 * ct);
  float rp = (n1 * ct - n2 * ci) / max(1e-7, n1 * ct + n2 * ci);
  return .5 * (rs * rs + rp * rp);
}
vec3 surfaceLight(vec3 p, vec3 n, vec3 d, int id) {
  vec3 base = colorAt(id), light = rotateY(normalize(vec3(-3., 5., 4.)), -uEnvRotation);
  float roughness = optics(id).z, dif = max(0., dot(n, light));
  vec3 halfv = normalize(light - d);
  float spec = pow(max(0., dot(n, halfv)), mix(180., 6., roughness));
  return base * (.12 + .65 * dif + .18 * roughEnvironment(n, .6)) +
         vec3(1.7, 1.6, 1.45) * spec * .35;
}
vec3 absorption(int id, float distance) {
  if (id < 0)
    return vec3(1);
  return exp(-(vec3(1) - colorAt(id)) * .65 * optics(id).x * min(distance, 30.));
}
vec3 metalFresnel(vec3 base, float ci) {
  return base + (vec3(1) - base) * pow(1. - ci, 5.);
}
// Secondary reflection paths use all scene boundaries too; tertiary branches
// resolve to the environment to keep the work bounded on WebGL hardware.
vec3 reflectionPath(vec3 o, vec3 d, float roughness) {
  vec3 light = vec3(0), weight = vec3(1);
  int mask = materialMask(o);
  for (int j = 0; j < 4; j++) {
    float level, sign;
    int id;
    float s = sceneHit(o, d, level, sign, id);
    if (s < 0.)
      break;
    int before = mediumFor(mask);
    vec3 p = o + s * d, g = normalAt(p, level), n = dot(d, g) < 0. ? g : -g;
    float eps = rayEpsilon(p);
    bool tangent = abs(dot(d, g)) < 3e-4;
    int nextMask = tangent ? mask : maskAcross(level, dot(d, g) > 0.);
    int after = mediumFor(nextMask);
    weight *= absorption(before, s);
    if (before == after && !tangent) {
      mask = nextMask;
      o = p - n * eps;
      continue;
    }
    int surface = interfaceMaterial(before, after);
    if (surface < 0)
      surface = id;
    vec4 mat = optics(surface);
    vec3 r = reflect(d, n);
    float ci = clamp(dot(-d, n), 0., 1.);
    if (mat.w > .5) {
      weight *= metalFresnel(colorAt(surface), ci);
      o = p + n * eps;
      d = r;
      roughness = mat.z;
      continue;
    }
    float n1 = optics(before).y, n2 = optics(after).y, F = fresnel(ci, n1, n2);
    vec3 t = refract(d, n, n1 / n2);
    light += weight * mat.x * surfaceLight(p, n, d, surface);
    weight *= 1. - mat.x;
    if (dot(t, t) < 1e-10 && !tangent) {
      o = p + n * eps;
      d = r;
      roughness = mat.z;
      continue;
    }
    light += weight * F * roughEnvironment(r, mat.z);
    weight *= 1. - F;
    if (tangent) {
      o = p + d * eps * 4.;
      continue;
    }
    mask = nextMask;
    o = p - n * eps;
    d = normalize(t);
    roughness = 0.;
  }
  return light + weight * roughEnvironment(d, roughness);
}
vec3 trace(vec3 origin, vec3 direction) {
  vec3 o = origin, d = direction, radiance = vec3(0), throughput = vec3(1);
  int mask = materialMask(o);
  float roughness = 0.;
  for (int bounce = 0; bounce < 24; bounce++) {
    if (bounce >= uBounces)
      break;
    float level, sign;
    int id;
    float s = sceneHit(o, d, level, sign, id);
    int before = mediumFor(mask);
    if (s < 0.)
      return radiance + throughput * absorption(before, 12.) * roughEnvironment(d, roughness);
    vec3 p = o + s * d, g = normalAt(p, level), outward = sign * g, n = dot(g, d) < 0. ? g : -g;
    if (uMode == 1)
      return .5 + .5 * outward;
    if (uMode == 2) {
      float bands = .5 + .5 * cos(log(1. + s) * 12.);
      return mix(vec3(.035, .15, .19), vec3(.7, .87, .65), bands);
    }
    float eps = rayEpsilon(p);
    bool tangent = abs(dot(g, d)) < 3e-4;
    int nextMask = tangent ? mask : maskAcross(level, dot(d, g) > 0.);
    int after = mediumFor(nextMask);
    throughput *= absorption(before, s);
    // Boundaries hidden inside a more specific material are not optical interfaces.
    if (before == after && !tangent) {
      mask = nextMask;
      o = p - n * eps;
      continue;
    }
    int surface = interfaceMaterial(before, after);
    if (surface < 0)
      surface = id;
    vec4 mat = optics(surface);
    float ci = clamp(dot(-d, n), 0., 1.);
    vec3 reflected = reflect(d, n);
    if (mat.w > .5) {
      throughput *= metalFresnel(colorAt(surface), ci);
      o = p + n * eps;
      d = reflected;
      roughness = mat.z;
      continue;
    }
    float n1 = optics(before).y, n2 = optics(after).y, F = fresnel(ci, n1, n2);
    vec3 transmitted = refract(d, n, n1 / n2);
    bool tir = dot(transmitted, transmitted) < 1e-10;
    // Refraction event: numerical tests capture the state at this point.
    radiance += throughput * mat.x * surfaceLight(p, n, d, surface);
    throughput *= 1. - mat.x;
    if (max(throughput.r, max(throughput.g, throughput.b)) < .006)
      return radiance;
    if (tir && !tangent) {
      o = p + n * eps;
      d = reflected;
      roughness = mat.z;
      continue;
    }
    radiance += throughput * F *
                (bounce == 0 ? reflectionPath(p + n * eps, reflected, mat.z)
                             : roughEnvironment(reflected, mat.z));
    throughput *= 1. - F;
    if (tangent) {
      o = p + d * eps * 4.;
      continue;
    }
    mask = nextMask;
    d = normalize(transmitted);
    o = p - n * eps;
    roughness = 0.;
  }
  return radiance + throughput * roughEnvironment(d, roughness);
}
void main() {
  vec2 uv = (gl_FragCoord.xy - .5 * uResolution) / uResolution.y;
  vec3 d = normalize(uForward + 1.05 * (uv.x * uRight + uv.y * uUp));
  vec3 col = trace(uEye, d);
  if (uMode == 0) {
    col = col / (1. + col);
    col = pow(max(col, 0.), vec3(1. / 2.2));
  }
  float vignette = 1. - .16 * dot(uv, uv);
  outColor = vec4(col * max(.6, vignette), 1);
}`;
