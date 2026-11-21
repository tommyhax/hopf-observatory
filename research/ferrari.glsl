// Float32 GLSL adaptation of Jochen Schwarze, Cubic and Quartic Roots,
// Graphics Gems (1990), Roots3And4.c. See THIRD_PARTY.md for source/licence.
// Uses a float32 near-zero tolerance of 1e-6. Exact leading-zero fallback is added for degree loss.
bool zeroF(float x) {
  return abs(x) < 1e-6;
}
float cubeRoot(float x) {
  return sign(x) * pow(abs(x), 1. / 3.);
}
int quadraticF(vec3 c, out vec4 s) {
  s = vec4(0);
  if (c.z == 0.) {
    if (c.y == 0.)
      return 0;
    s.x = -c.x / c.y;
    return 1;
  }
  float p = c.y / (2. * c.z), q = c.x / c.z, D = p * p - q;
  if (zeroF(D)) {
    s.x = -p;
    return 1;
  }
  if (D < 0.)
    return 0;
  s.xy = vec2(sqrt(D) - p, -sqrt(D) - p);
  return 2;
}
int cubicF(vec4 c, out vec4 s) {
  if (c.w == 0.)
    return quadraticF(c.xyz, s);
  float A = c.z / c.w, B = c.y / c.w, C = c.x / c.w, aa = A * A;
  float p = (-aa / 3. + B) / 3., q = (2. * A * aa / 27. - A * B / 3. + C) / 2.;
  float p3 = p * p * p, D = q * q + p3;
  int n;
  s = vec4(0);
  if (zeroF(D)) {
    if (zeroF(q)) {
      n = 1;
    } else {
      float u = cubeRoot(-q);
      s.xy = vec2(2. * u, -u);
      n = 2;
    }
  } else if (D < 0.) {
    float phi = acos(clamp(-q / sqrt(-p3), -1., 1.)) / 3., t = 2. * sqrt(-p);
    s.xyz = vec3(t * cos(phi), -t * cos(phi + PI / 3.), -t * cos(phi - PI / 3.));
    n = 3;
  } else {
    float z = sqrt(D);
    s.x = cubeRoot(z - q) - cubeRoot(z + q);
    n = 1;
  }
  s -= A / 3.;
  return n;
}
int quarticF(vec4 c, float leading, out vec4 s) {
  if (leading == 0.)
    return cubicF(c, s);
  float A = c.w / leading, B = c.z / leading, C = c.y / leading, D = c.x / leading, aa = A * A;
  float p = -3. * aa / 8. + B, q = aa * A / 8. - A * B / 2. + C,
        r = -3. * aa * aa / 256. + aa * B / 16. - A * C / 4. + D;
  int n;
  s = vec4(0);
  if (zeroF(r)) {
    n = cubicF(vec4(q, p, 0, 1), s);
    s[n] = 0.;
    n++;
  } else {
    vec4 zroots;
    int nz = cubicF(vec4(r * p / 2. - q * q / 8., -r, -p / 2., 1), zroots);
    if (nz == 0)
      return 0;
    float z = zroots.x, u = z * z - r, v = 2. * z - p;
    if (zeroF(u))
      u = 0.;
    else if (u > 0.)
      u = sqrt(u);
    else
      return 0;
    if (zeroF(v))
      v = 0.;
    else if (v > 0.)
      v = sqrt(v);
    else
      return 0;
    vec4 left, right;
    int nl = quadraticF(vec3(z - u, q < 0. ? -v : v, 1), left),
        nr = quadraticF(vec3(z + u, q < 0. ? v : -v, 1), right);
    n = nl + nr;
    for (int i = 0; i < 4; i++) {
      if (i < nl)
        s[i] = left[i];
      else if (i < n)
        s[i] = right[i - nl];
    }
  }
  s -= A / 4.;
  return n;
}
float ferrariHit(vec3 o, vec3 d, float level) {
  float k = dot(o, d);
  vec3 C = o - k * d;
  float L = max(1., length(C));
  vec4 v0 = vec4(2. * C, dot(C, C) - 1.), v1 = vec4(2. * L * d, 2. * L * dot(C, d)),
       v2 = vec4(0, 0, 0, L * L);
  vec4 a = vec4(form(v0, v0, level), 2. * form(v0, v1, level),
                form(v1, v1, level) + 2. * form(v0, v2, level), 2. * form(v1, v2, level));
  float a4 = form(v2, v2, level);
  vec4 roots;
  int n = quarticF(a, a4, roots);
  float best = -1., minS = .5 * rayEpsilon(o);
  for (int i = 0; i < 4; i++) {
    if (i >= n)
      break;
    float x = L * roots[i];
    if (isnan(x) || isinf(x))
      continue;
    // Share the production coordinate polish and acceptance criterion;
    // only root construction/isolation differs between the two methods.
    float sg = x < 0. ? -1. : 1.;
    bool farChart = abs(x) > L;
    vec4 a, b, c;
    chartVectors(C, sg * d, L, farChart, a, b, c);
    float coordinate = farChart ? L / abs(x) : abs(x) / L;
    coordinate = refineChart(a, b, c, coordinate, level);
    if (farChart && coordinate <= 0.)
      continue;
    float distance = farChart ? L / coordinate : L * coordinate;
    float s = sg * distance - k;
    if (s > minS && !isnan(s) && !isinf(s) &&
        chartResidual(a, b, c, coordinate, farChart, level) < 2e-6 && (best < 0. || s < best))
      best = s;
  }
  return best;
}
