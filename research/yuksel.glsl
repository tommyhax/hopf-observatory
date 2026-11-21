// Bracketed Newton-bisection following Yuksel (HPG 2022), adapted from
// Christoph Peters's CC0 GLSL implementation (2023). See THIRD_PARTY.md.
// This degree <= 4 port handles exact degree loss and closed endpoints.
// All coordinate variants use the same 90-iteration / float-stagnation policy.
const float Y_NO_ROOT = 3.4e38;

bool ySameSign(float a, float b) {
  // Multiplying signs can overflow or underflow, particularly in far charts.
  return (a > 0. && b > 0.) || (a < 0. && b < 0.);
}
float yValue(float p[5], float x) {
  float v = p[4];
  for (int i = 3; i >= 0; --i)
    v = v * x + p[i];
  return v;
}
bool yNewton(out float root, out float endValue, float p[5], float begin, float end,
             float beginValue) {
  endValue = yValue(p, end);
  if (beginValue == 0.) {
    root = begin;
    return true;
  }
  if (endValue == 0.) {
    root = end;
    return true;
  }
  if (begin == end || ySameSign(beginValue, endValue))
    return false;
  float current = .5 * begin + .5 * end;
  for (int i = 0; i < 90; ++i) {
    float v = p[4] * current + p[3], dv = p[4];
    for (int j = 2; j >= 0; --j) {
      dv = dv * current + v;
      v = v * current + p[j];
    }
    if (v == 0.)
      break;
    bool right = ySameSign(beginValue, v);
    begin = right ? current : begin;
    end = right ? end : current;
    float guess = current - v / dv;
    float next = guess >= begin && guess <= end ? guess : .5 * begin + .5 * end;
    bool done = next == current;
    current = next;
    if (done)
      break;
  }
  root = current;
  return true;
}

// Exact zero leading coefficients select the degree. No epsilon demotion:
// a tiny nonzero quartic term may encode a very distant finite intersection.
int yDegree(float p[5]) {
  for (int i = 4; i >= 0; --i) {
    if (p[i] != 0.)
      return i;
  }
  return -1;
}

// BEGIN DEGREE SPECIALIZATION
void yRootsDegree(float p[5], float begin, float end, out float roots[5]) {
  for (int i = 0; i < 5; ++i)
    roots[i] = Y_NO_ROOT;
  const int n = Y_DEGREE;
  // Start with the quadratic derivative, divided by (n-2)! as in Peters.
  float d[5];
  for (int i = 0; i < 5; ++i)
    d[i] = 0.;
  d[0] = p[n - 2];
  d[1] = float(n - 1) * p[n - 1];
  d[2] = .5 * float(n * (n - 1)) * p[n];
  // Scale only the quadratic formula; keep d for the integration recurrence.
  float scale = max(abs(d[0]), max(abs(d[1]), abs(d[2])));
  vec3 q = vec3(d[0], d[1], d[2]) / scale;
  float disc = q.y * q.y - 4. * q.x * q.z;
  for (int i = 0; i <= 4; ++i)
    roots[i] = begin;
  if (disc >= 0.) {
    float z = -.5 * (q.y + (q.y > 0. ? sqrt(disc) : -sqrt(disc)));
    // x^2 has z=0; the cancellation-resistant formula otherwise uses c/z.
    float x0 = z == 0. ? 0. : q.x / z;
    float x1 = z / q.z;
    if (n == 2) {
      roots[0] = min(x0, x1);
      roots[1] = max(x0, x1);
    } else {
      roots[n - 2] = clamp(min(x0, x1), begin, end);
      roots[n - 1] = clamp(max(x0, x1), begin, end);
    }
  } else if (n == 2) {
    roots[0] = roots[1] = Y_NO_ROOT;
  }
  roots[n] = end;
  // Integrate successive derivatives; their roots partition monotone intervals.
  for (int degree = 3; degree <= 4; ++degree) {
    if (degree > n)
      break;
    for (int i = 4; i > 0; --i)
      d[i] = d[i - 1] * (float(n + 1 - degree) / float(i));
    d[0] = p[n - degree];
    float beginValue = yValue(d, begin);
    for (int i = 0; i < 4; ++i) {
      if (i < n - degree || i >= n)
        continue;
      float root, endValue;
      bool found = yNewton(root, endValue, d, roots[i], roots[i + 1], beginValue);
      beginValue = endValue;
      if (found)
        roots[i] = root;
      else
        roots[i] = degree < n ? (i > 0 ? roots[i - 1] : begin) : Y_NO_ROOT;
    }
  }
  for (int i = 0; i < 5; ++i) {
    if (i >= n || roots[i] < begin || roots[i] > end)
      roots[i] = Y_NO_ROOT;
  }
}

// END DEGREE SPECIALIZATION

void yRoots(float p[5], float begin, float end, out float roots[5]) {
  int n = yDegree(p);
  if (n == 4)
    yRoots4(p, begin, end, roots);
  else if (n == 3)
    yRoots3(p, begin, end, roots);
  else if (n == 2)
    yRoots2(p, begin, end, roots);
  else {
    for (int i = 0; i < 5; ++i)
      roots[i] = Y_NO_ROOT;
    if (n == 1) {
      float x = -p[0] / p[1];
      if (x >= begin && x <= end)
        roots[0] = x;
    }
  }
}

// Cauchy's bound for the polynomial actually formed on the GPU. This bound
// depends only on coefficients, never on reference roots or a scene far clip.
float yBound(float p[5]) {
  int n = yDegree(p);
  if (n <= 0)
    return 1.;
  float largest = 0.;
  for (int i = 0; i < 4; ++i) {
    if (i < n)
      largest = max(largest, abs(p[i] / p[n]));
  }
  // Slight inflation compensates for rounding of the bound, not the roots.
  return (1. + largest) * 1.000001;
}
