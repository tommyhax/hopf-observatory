// Research adapter: enumerate roots of the ORIGINAL ray using production
// polynomial/isolation helpers. Never call intersection() repeatedly or move o.
// Four MRT attachments retain up to sixteen candidates, including false roots.
layout(location = 1) out vec4 roots1;
layout(location = 2) out vec4 roots2;
layout(location = 3) out vec4 roots3;
uniform int uMethod, uPolish;
float hits[16];
int hitCount;

void recordHit(float s) {
  if (isnan(s) || isinf(s)) {
    if (hitCount < 16)
      hits[hitCount++] = -2.; // Explicit numerical failure, not an empty slot.
    return;
  }
  if (s <= 0.)
    return;
  // Collapse only identical float values, e.g. a double root at a shared
  // derivative endpoint. Never merge by a distance tolerance.
  for (int i = 0; i < 16; ++i) {
    if (i < hitCount && hits[i] == s)
      return;
  }
  if (hitCount < 16)
    hits[hitCount++] = s;
}
void powerCoefficients(vec4 a, vec4 b, vec4 c, float level, out float p[5]) {
  p[0] = form(a, a, level);
  p[1] = 2. * form(a, b, level);
  p[2] = form(b, b, level) + 2. * form(a, c, level);
  p[3] = 2. * form(b, c, level);
  p[4] = form(c, c, level);
}
void recordCoordinate(vec4 a, vec4 b, vec4 c, float x, bool farChart, float sign, float L, float k,
                      float level, bool ownedChart) {
  if (isnan(x) || isinf(x)) {
    recordHit(x);
    return;
  }
  if (uPolish != 0)
    x = refineChart(a, b, c, x, level);
  // Both charts include the junction: independently rounded coefficients can
  // retain that root in only one chart. recordHit removes exact duplicates.
  // Far x=0 is infinity, never a finite root. Positive near owns the center.
  if (farChart && x <= 0.)
    return;
  if (ownedChart && !farChart && sign < 0. && x == 0.)
    return;
  if (uPolish != 0 && !(chartResidual(a, b, c, x, farChart, level) < 2e-6))
    return;
  recordHit(sign * (farChart ? L / x : L * x) - k);
}
void collectChart(vec3 center, vec3 direction, float L, float k, float sign, bool farChart,
                  float level) {
  vec4 a, b, c;
  chartVectors(center, direction, L, farChart, a, b, c);
  if (uMethod == 0) {
    vec4 roots;
    int count;
    quarticRoots(chartPoly(a, b, c, level), roots, count);
    for (int i = 0; i < 4; ++i) {
      if (i < count)
        recordCoordinate(a, b, c, roots[i], farChart, sign, L, k, level, true);
    }
  } else {
    float p[5], roots[5];
    powerCoefficients(a, b, c, level, p);
    yRoots(p, 0., 1., roots);
    for (int i = 0; i < 4; ++i) {
      if (roots[i] != Y_NO_ROOT)
        recordCoordinate(a, b, c, roots[i], farChart, sign, L, k, level, true);
    }
  }
}
void collectDirect(vec3 center, vec3 d, float L, float k, float level) {
  vec4 a, b, c;
  chartVectors(center, d, L, false, a, b, c);
  float p[5], roots[5];
  powerCoefficients(a, b, c, level, p);
  if (uMethod == 1) {
    float bound = yBound(p);
    if (isinf(bound) || isnan(bound)) {
      recordHit(bound);
      return;
    }
    yRoots(p, -bound, bound, roots);
  } else {
    vec4 r;
    int count = quarticF(vec4(p[0], p[1], p[2], p[3]), p[4], r);
    for (int i = 0; i < 4; ++i)
      roots[i] = i < count ? r[i] : Y_NO_ROOT;
    roots[4] = Y_NO_ROOT;
  }
  for (int i = 0; i < 4; ++i) {
    float x = roots[i];
    if (x == Y_NO_ROOT)
      continue;
    if (uPolish == 0) {
      // Preserve the affine solver's raw distance: converting to a reciprocal
      // coordinate and back would introduce an unrelated rounding step.
      recordHit(L * x - k);
      continue;
    }
    // The direct solver enumerates signed lambda/L. Convert candidates to the
    // same chart only for shared polishing/acceptance, never for isolation.
    float sign = x < 0. ? -1. : 1.;
    bool farChart = abs(x) > 1.;
    chartVectors(center, sign * d, L, farChart, a, b, c);
    recordCoordinate(a, b, c, farChart ? 1. / abs(x) : abs(x), farChart, sign, L, k, level, false);
  }
}
void main() {
  hitCount = 0;
  for (int i = 0; i < 16; ++i)
    hits[i] = -1.;
  float k = dot(uEye, uForward);
  vec3 center = uEye - k * uForward;
  float L = max(1., length(center));
  if (uMethod == 1 || uMethod == 3) {
    collectDirect(center, uForward, L, k, uC);
  } else {
    for (int side = 0; side < 2; ++side) {
      float sign = side == 0 ? -1. : 1.;
      collectChart(center, sign * uForward, L, k, sign, false, uC);
      collectChart(center, sign * uForward, L, k, sign, true, uC);
    }
  }
  outColor = vec4(hits[0], hits[1], hits[2], hits[3]);
  roots1 = vec4(hits[4], hits[5], hits[6], hits[7]);
  roots2 = vec4(hits[8], hits[9], hits[10], hits[11]);
  roots3 = vec4(hits[12], hits[13], hits[14], hits[15]);
}
