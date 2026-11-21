// Alternative intersection backends. Optical transport remains unchanged.
void rendererPower(vec4 a, vec4 b, vec4 c, float level, out float p[5]) {
  p[0] = form(a, a, level);
  p[1] = 2. * form(a, b, level);
  p[2] = form(b, b, level) + 2. * form(a, c, level);
  p[3] = 2. * form(b, c, level);
  p[4] = form(c, c, level);
}
float yukselChartIntersection(vec3 center, vec3 direction, float L, float k, float sign,
                              bool farChart, float minS, float level) {
  vec4 a, b, c;
  chartVectors(center, direction, L, farChart, a, b, c);
  // Share the production Bernstein hull rejection before expensive isolation.
  Poly hull = chartPoly(a, b, c, level);
  float minimum = min(min(hull.a.x, hull.a.y), min(hull.a.z, hull.a.w));
  float maximum = max(max(hull.a.x, hull.a.y), max(hull.a.z, hull.a.w));
  if (min(minimum, hull.b) > 0. || max(maximum, hull.b) < 0.)
    return -1.;
  float p[5], roots[5];
  rendererPower(a, b, c, level, p);
  yRoots(p, 0., 1., roots);
  float best = -1.;
  for (int i = 0; i < 4; ++i) {
    if (roots[i] == Y_NO_ROOT)
      continue;
    float x = refineChart(a, b, c, roots[i], level);
    if (farChart && x <= 0.)
      continue;
    float s = sign * (farChart ? L / x : L * x) - k;
    if (s > minS && !isinf(s) && !isnan(s) && chartResidual(a, b, c, x, farChart, level) < 2e-6 &&
        (best < 0. || s < best))
      best = s;
  }
  return best;
}
float yukselDirectIntersection(vec3 o, vec3 d, float level) {
  float k = dot(o, d);
  vec3 center = o - k * d;
  float L = max(1., length(center)), minS = .5 * rayEpsilon(o);
  vec4 a, b, c;
  chartVectors(center, d, L, false, a, b, c);
  float p[5], roots[5];
  rendererPower(a, b, c, level, p);
  float bound = yBound(p);
  if (isinf(bound) || isnan(bound))
    return -1.;
  yRoots(p, -bound, bound, roots);
  float best = -1.;
  for (int i = 0; i < 4; ++i) {
    if (roots[i] == Y_NO_ROOT || isnan(roots[i]) || isinf(roots[i]))
      continue;
    float sign = roots[i] < 0. ? -1. : 1.;
    bool farChart = abs(roots[i]) > 1.;
    chartVectors(center, sign * d, L, farChart, a, b, c);
    float x = farChart ? 1. / abs(roots[i]) : abs(roots[i]);
    x = refineChart(a, b, c, x, level);
    if (farChart && x <= 0.)
      continue;
    float s = sign * (farChart ? L / x : L * x) - k;
    if (s > minS && !isinf(s) && !isnan(s) && chartResidual(a, b, c, x, farChart, level) < 2e-6 &&
        (best < 0. || s < best))
      best = s;
  }
  return best;
}
