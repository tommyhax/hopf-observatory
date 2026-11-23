// Float32 research adaptation of Orellana--De Michele Algorithm 1010.
// Based on the BSD-licensed OpenMC implementation; copyright (c) 2020
// Alberto Giacomo Orellana and Cristiano De Michele. See LICENSE and SOURCES.md.
// Includes the 2024 sqrt(epsilon) near-degenerate-factor comparison and
// best-absolute-residual factor refinement. No iterative quartic fallback.
const float O_EPS = 1.1920928955078125e-7;
const float O_NEAR = 3.4526698300124393e-4; // sqrt(float32 epsilon)
const float O_QSCALE = 2654435700.;         // FLT_MAX^(1/4) / golden ratio
bool oFinite(float x) {
  return !isnan(x) && !isinf(x);
}
float oNan() {
  return uintBitsToFloat(0x7fc00000u);
}
float oSign(float x) {
  return x < 0. ? -1. : 1.;
}
float oCbrt(float x) {
  return sign(x) * pow(abs(x), 1. / 3.);
}
float oError(float value, float target) {
  return target == 0. ? abs(value) : abs((value - target) / target);
}
// Monic quadratic, cancellation-resistant extraction of its smaller root.
int oQuadratic(float a, float b, out vec4 roots) {
  roots = vec4(0);
  float disc = a * a - 4. * b;
  if (disc < 0.)
    return 0;
  if (disc == 0.) {
    roots.x = -.5 * a;
    return 1;
  }
  if (!oFinite(disc)) {
    float scale = max(abs(a), sqrt(abs(b)));
    float aa = a / scale, bb = (b / scale) / scale;
    disc = aa * aa - 4. * bb;
    if (disc < 0.)
      return 0;
    roots.x = -.5 * (aa + oSign(aa) * sqrt(disc)) * scale;
  } else {
    roots.x = -.5 * (a + oSign(a) * sqrt(disc));
  }
  roots.y = roots.x == 0. ? 0. : b / roots.x;
  return roots.x == roots.y ? 1 : 2;
}
// Dominant real root of x^3 + g*x + h. Overflow-safe ratio form of Cardano.
float oDominant(float g, float h) {
  float Q = -g / 3., R = .5 * h, x;
  if (R == 0.)
    return g <= 0. ? sqrt(-g) : 0.;
  float K;
  if (abs(Q) < abs(R)) {
    float ratio = Q / R;
    K = 1. - Q * ratio * ratio;
  } else {
    float ratio = R / Q;
    K = oSign(Q) * (ratio * ratio / Q - 1.);
  }
  if (K < 0.) {
    float theta = acos(clamp((R / abs(Q)) / sqrt(Q), -1., 1.));
    x = -2. * sqrt(Q) * cos((theta < .5 * PI ? theta : theta + 2. * PI) / 3.);
  } else {
    float value =
        abs(Q) < abs(R) ? abs(R) * (1. + sqrt(K)) : abs(R) + sqrt(abs(Q)) * abs(Q) * sqrt(K);
    float A = -oSign(R) * oCbrt(value);
    x = A + (A == 0. ? 0. : Q / A);
  }
  float f = x * (x * x + g) + h;
  float magnitude = max(max(abs(x * x * x), abs(g * x)), abs(h));
  if (abs(f) > O_EPS * magnitude) {
    for (int i = 0; i < 8; ++i) {
      float df = 3. * x * x + g;
      if (df == 0.)
        break;
      float next = x - f / df, value = next * (next * next + g) + h;
      if (!oFinite(next) || !(abs(value) < abs(f)))
        break;
      x = next;
      f = value;
      if (f == 0.)
        break;
    }
  }
  return x;
}
// Lower-degree handling is separate from Algorithm 1010. Exact degree loss
// only; dominant cubic root, residual-decreasing polish, stable deflation.
int oCubic(vec4 p, out vec4 roots) {
  roots = vec4(0);
  if (p.w == 0.) {
    if (p.z != 0.)
      return oQuadratic(p.y / p.z, p.x / p.z, roots);
    if (p.y == 0.)
      return 0;
    roots.x = -p.x / p.y;
    return 1;
  }
  if (p.x == 0.) {
    int n = oQuadratic(p.z / p.w, p.y / p.w, roots);
    roots[n] = 0.;
    return n + 1;
  }
  vec3 m = p.zyx / p.w;
  float a = m.x, b = m.y, c = m.z;
  float g = b - a * a / 3., h = (2. * a * a / 27. - b / 3.) * a + c;
  float r = oDominant(g, h) - a / 3.;
  for (int i = 0; i < 4; ++i) {
    float f = ((r + a) * r + b) * r + c, df = (3. * r + 2. * a) * r + b;
    if (df == 0.)
      break;
    float next = r - f / df, nf = ((next + a) * next + b) * next + c;
    if (!oFinite(next) || !(abs(nf) < abs(f)))
      break;
    r = next;
  }
  if (!oFinite(r) || r == 0.) {
    roots.x = oNan();
    return 1;
  }
  float v = -c / r, u = (v - b) / r;
  if (abs(r * r) < abs(v)) {
    u = a + r;
    v = b + u * r;
  }
  int n = oQuadratic(u, v, roots);
  roots[n] = r;
  return n + 1;
}
float oPhi(vec4 m) {
  float a = m.x, b = m.y, c = m.z, d = m.w;
  float disc = 9. * a * a - 24. * b;
  float shift = disc > 0. ? -2. * b / (3. * a + oSign(a) * sqrt(disc)) : -.25 * a;
  float aa = a + 4. * shift;
  float bb = b + 3. * shift * (a + 2. * shift);
  float cc = c + shift * (2. * b + shift * (3. * a + 4. * shift));
  float dd = d + shift * (c + shift * (b + shift * (a + shift)));
  float gg = bb * bb / 9., hh = aa * cc;
  float g = hh - 4. * dd - 3. * gg;
  float h = (8. * dd + hh - 2. * gg) * bb / 3. - cc * cc - dd * aa * aa;
  return oDominant(g, h);
}
float oLDLError(vec4 m, float l1, float l3, vec2 candidate) {
  float d2 = candidate.x, l2 = candidate.y;
  return oError(d2 + l1 * l1 + 2. * l3, m.y) + oError(2. * d2 * l2 + 2. * l1 * l3, m.z) +
         oError(d2 * l2 * l2 + l3 * l3, m.w);
}
// q=(alpha1,beta1,alpha2,beta2): (x²+alpha1*x+beta1)(x²+alpha2*x+beta2).
vec4 oProduct(vec4 q) {
  return vec4(q.x + q.z, q.y + q.x * q.z + q.w, q.y * q.z + q.x * q.w, q.y * q.w);
}
float oFactorError(vec4 m, vec4 q) {
  vec4 value = oProduct(q);
  return oError(value.x, m.x) + oError(value.y, m.y) + oError(value.z, m.z) + oError(value.w, m.w);
}
void oConsider(vec4 m, vec4 candidate, inout vec4 q, inout float best) {
  float error = oFactorError(m, candidate);
  if (oFinite(error) && error < best) {
    q = candidate;
    best = error;
  }
}
// Real coefficients of the product of two conjugate quadratic factors.
vec4 oComplexProduct(vec4 q) {
  return vec4(2. * q.x, 2. * q.y + q.x * q.x + q.z * q.z, 2. * (q.x * q.y + q.z * q.w),
              q.y * q.y + q.w * q.w);
}
float oComplexError(vec4 m, vec4 q) {
  vec4 value = oComplexProduct(q);
  return oError(value.x, m.x) + oError(value.y, m.y) + oError(value.z, m.z) + oError(value.w, m.w);
}
vec4 oRefineFactors(vec4 m, vec4 q) {
  float relative = oFactorError(m, q);
  float absolute = dot(abs(oProduct(q) - m), vec4(1));
  vec4 best = q;
  for (int i = 0; i < 20; ++i) {
    if (absolute == 0.)
      break;
    vec4 f = (oProduct(q) - m).wzyx;
    float delta = q.x - q.z;
    float det = q.y * q.y + q.y * (-q.z * delta - 2. * q.w) + q.w * (q.x * delta + q.w);
    if (det == 0. || !oFinite(det))
      break;
    float c2 = q.w - q.y, c3 = q.y * q.z - q.x * q.w;
    vec4 step;
    step.x = dot(vec4(delta, c2, c3, -q.y * c2 - q.x * c3), f);
    step.y = dot(vec4(q.x * delta + c2, -q.y * delta, -q.y * c2, -q.y * c3), f);
    step.z = dot(vec4(-delta, -c2, -c3, q.z * c3 + q.w * c2), f);
    step.w = dot(vec4(-q.z * delta - c2, q.w * delta, q.w * c2, q.w * c3), f);
    vec4 next = q - step / det;
    float nextRelative = oFactorError(m, next);
    float nextAbsolute = dot(abs(oProduct(next) - m), vec4(1));
    if (oFinite(nextAbsolute) && nextAbsolute < absolute) {
      best = next;
      absolute = nextAbsolute;
    }
    if (!oFinite(nextRelative) || nextRelative >= relative)
      break;
    q = next;
    relative = nextRelative;
  }
  return best;
}
vec2 oMul(vec2 a, vec2 b) {
  return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}
vec2 oDiv(vec2 a, vec2 b) {
  float scale = max(abs(b.x), abs(b.y));
  vec2 bs = b / scale;
  return oMul(a / scale, vec2(bs.x, -bs.y)) / dot(bs, bs);
}
vec2 oSqrt(vec2 z) {
  if (z.y == 0.)
    return z.x >= 0. ? vec2(sqrt(z.x), 0) : vec2(0, sqrt(-z.x));
  float scale = max(abs(z.x), abs(z.y));
  float radius = length(z / scale) * scale;
  float t = sqrt(.5 * radius + .5 * abs(z.x));
  return z.x >= 0. ? vec2(t, z.y / (2. * t)) : vec2(abs(z.y) / (2. * t), oSign(z.y) * t);
}
int oQuartic(vec4 p, float lead, out vec4 roots) {
  roots = vec4(0);
  if (lead == 0.)
    return oCubic(p, roots);
  if (p.x == 0.) {
    int count = oCubic(vec4(p.yzw, lead), roots);
    roots[count] = 0.;
    return count + 1;
  }
  vec4 m = p.wzyx / lead;
  float scale = 1., phi = oPhi(m);
  if (!oFinite(phi)) {
    scale = O_QSCALE;
    m /= vec4(scale, scale * scale, scale * scale * scale, (scale * scale) * (scale * scale));
    phi = oPhi(m);
  }
  if (!oFinite(phi)) {
    roots.x = oNan();
    return 1;
  }
  float l1 = .5 * m.x, l3 = m.y / 6. + .5 * phi;
  float delta = m.z - m.x * l3, d2first = 2. * m.y / 3. - phi - l1 * l1;
  float d3 = m.w - l3 * l3;
  vec2 choice = vec2(0);
  float best = 3.4e38;
  for (int i = 0; i < 3; ++i) {
    vec2 candidate;
    if (i == 0) {
      if (d2first == 0.)
        continue;
      candidate = vec2(d2first, delta / (2. * d2first));
    } else {
      if (delta == 0.)
        continue;
      float l2 = 2. * d3 / delta;
      if (i == 1 && l2 == 0.)
        continue;
      candidate = vec2(i == 1 ? delta / (2. * l2) : d2first, l2);
    }
    float error = oLDLError(m, l1, l3, candidate);
    if (oFinite(error) && error < best) {
      best = error;
      choice = candidate;
    }
  }
  float d2 = choice.x, l2 = choice.y;
  vec4 q = vec4(0), cq = vec4(0);
  bool realFactors = false;
  best = 3.4e38;
  if (d2 < 0.) {
    float gamma = sqrt(-d2);
    q = vec4(l1 + gamma, l3 + gamma * l2, l1 - gamma, l3 - gamma * l2);
    if (abs(q.w) < abs(q.y))
      q.w = m.w / q.y;
    else if (abs(q.y) < abs(q.w))
      q.y = m.w / q.w;
    bool adjustFirst = abs(q.x) < abs(q.z);
    vec4 base = q;
    // Evaluate the three algebraically equivalent estimates of the smaller alpha.
    for (int i = 0; i < 3; ++i) {
      vec4 candidate = base;
      if (adjustFirst) {
        if (i == 0 && base.w == 0.)
          continue;
        if (i == 1 && base.z == 0.)
          continue;
        candidate.x = i == 0   ? (m.z - base.y * base.z) / base.w
                      : i == 1 ? (m.y - base.w - base.y) / base.z
                               : m.x - base.z;
      } else {
        if (i == 0 && base.y == 0.)
          continue;
        if (i == 1 && base.x == 0.)
          continue;
        candidate.z = i == 0   ? (m.z - base.x * base.w) / base.y
                      : i == 1 ? (m.y - base.y - base.w) / base.x
                               : m.x - base.x;
      }
      oConsider(m, candidate, q, best);
    }
    realFactors = true;
  } else if (d2 > 0.) {
    float gamma = sqrt(d2);
    cq = vec4(l1, l3, gamma, gamma * l2);
    best = oComplexError(m, cq);
  }
  // 2024 correction: compare the d2=0 factorization over a wider neighborhood.
  if (d2 == 0. || abs(d2) <= O_NEAR * (abs(2. * m.y / 3.) + abs(phi) + l1 * l1)) {
    if (d3 <= 0.) {
      float radius = sqrt(-d3);
      vec4 candidate = vec4(l1, l3 + radius, l1, l3 - radius);
      if (abs(candidate.w) < abs(candidate.y))
        candidate.w = m.w / candidate.y;
      else if (abs(candidate.y) < abs(candidate.w))
        candidate.y = m.w / candidate.w;
      float error = oFactorError(m, candidate);
      // With contracted float32 arithmetic, a spurious positive d2 can give
      // conjugate factors whose rounded reconstruction ties an exact real
      // factorization (e.g. (x-1)^4). Prefer real factors on that tie only.
      if (d2 == 0. || error < best || (!realFactors && error == best)) {
        q = candidate;
        realFactors = true;
        best = error;
      }
    } else {
      vec4 candidate = vec4(l1, l3, 0, sqrt(d3));
      float error = oComplexError(m, candidate);
      if (d2 == 0. || error < best) {
        cq = candidate;
        realFactors = false;
        best = error;
      }
    }
  }
  int count = 0;
  if (realFactors) {
    q = oRefineFactors(m, q);
    vec4 first, second;
    int n1 = oQuadratic(q.x, q.y, first), n2 = oQuadratic(q.z, q.w, second);
    for (int i = 0; i < 2; ++i)
      if (i < n1)
        roots[count++] = first[i];
    for (int i = 0; i < 2; ++i)
      if (i < n2)
        roots[count++] = second[i];
  } else {
    vec2 a = cq.xz, b = cq.yw;
    vec2 rad = oSqrt(.25 * oMul(a, a) - b);
    vec2 r1 = -.5 * a + rad, r2 = -.5 * a - rad;
    if (length(r1) < length(r2)) {
      vec2 swap = r1;
      r1 = r2;
      r2 = swap;
    }
    if (any(notEqual(r1, vec2(0))))
      r2 = oDiv(b, r1);
    // No near-real threshold: complex roots are not ray intersections.
    if (r1.y == 0.)
      roots[count++] = r1.x;
    if (r2.y == 0.)
      roots[count++] = r2.x;
  }
  roots *= scale;
  return count;
}
