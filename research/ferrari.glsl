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
