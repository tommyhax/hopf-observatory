// Diagnostic-only entry point appended after the unchanged all-roots helpers.
// uDiagnostic=0 calls the unchanged collector. No rendering source is edited.
uniform int uDiagnostic, uChart;

void main() {
  if (uDiagnostic == 0) {
    baselineMain();
    return;
  }
  float k = dot(uEye, uForward);
  vec3 center = uEye - k * uForward;
  float L = max(1., length(center));
  bool direct = uChart == 4;
  float sign = uChart < 2 ? -1. : 1.;
  bool farChart = uChart == 1 || uChart == 3;
  vec4 a, b, c;
  chartVectors(center, sign * uForward, L, farChart, a, b, c);
  if (uDiagnostic == 1) {
    outColor = vec4(k, L, dot(uForward, uForward), 0.);
    roots1 = vec4(center, 0.);
    roots2 = roots3 = vec4(0.);
    return;
  }
  if (uDiagnostic == 2) {
    outColor = a;
    roots1 = b;
    roots2 = c;
    roots3 = vec4(k, L, sign, farChart ? 1. : 0.);
    return;
  }
  if (uDiagnostic == 6) {
    mat4 A = uP - mat4(uC);
    outColor = A[0]; roots1 = A[1]; roots2 = A[2]; roots3 = A[3];
    return;
  }
  float p[5];
  powerCoefficients(a, b, c, uC, p);
  Poly bp = chartPoly(a, b, c, uC);
  if (uDiagnostic == 3) {
    outColor = vec4(p[0], p[1], p[2], p[3]);
    roots1 = vec4(p[4], bp.b, yBound(p), 0.);
    roots2 = bp.a;
    roots3 = vec4(0.);
    return;
  }
  float xs[5];
  if (uMethod == 0) {
    vec4 r; int count;
    quarticRoots(bp, r, count);
    for (int i = 0; i < 5; ++i)
      xs[i] = i < count ? r[i] : Y_NO_ROOT;
  } else {
    float bound = direct ? yBound(p) : 1.;
    yRoots(p, direct ? -bound : 0., bound, xs);
  }
  vec4 rawX = vec4(Y_NO_ROOT), refinedX = vec4(Y_NO_ROOT);
  vec4 rawS = vec4(Y_NO_ROOT), refinedS = vec4(Y_NO_ROOT);
  vec4 rawResidual = vec4(-1.), refinedResidual = vec4(-1.);
  vec4 rawAccept = vec4(0.), refinedAccept = vec4(0.);
  for (int i = 0; i < 4; ++i) {
    if (xs[i] == Y_NO_ROOT) continue;
    float x = xs[i], sgn = sign;
    bool far = farChart;
    vec4 aa = a, bb = b, cc = c;
    rawX[i] = x;
    if (direct) {
      rawS[i] = L * x - k;
      sgn = x < 0. ? -1. : 1.;
      far = abs(x) > 1.;
      chartVectors(center, sgn * uForward, L, far, aa, bb, cc);
      x = far ? 1. / abs(x) : abs(x);
    } else {
      rawS[i] = sgn * (far ? L / x : L * x) - k;
    }
    rawResidual[i] = chartResidual(aa, bb, cc, x, far, uC);
    bool rawOwned = direct || (!(far && x <= 0.) && !(sign < 0. && !far && x == 0.));
    rawAccept[i] = rawOwned && rawS[i] > 0. ? 1. : 0.;
    x = refineChart(aa, bb, cc, x, uC);
    refinedX[i] = x;
    refinedS[i] = sgn * (far ? L / x : L * x) - k;
    refinedResidual[i] = chartResidual(aa, bb, cc, x, far, uC);
    bool owned = !(far && x <= 0.) && (direct || !(sign < 0. && !far && x == 0.));
    refinedAccept[i] = owned && refinedS[i] > 0. && refinedResidual[i] < 2e-6 ? 1. : 0.;
  }
  if (uDiagnostic == 4) {
    outColor = rawX; roots1 = refinedX; roots2 = rawS; roots3 = refinedS;
  } else {
    outColor = rawResidual; roots1 = refinedResidual;
    roots2 = rawAccept; roots3 = refinedAccept;
  }
}
