// Noise-aware Newton refinement. The error floor is a float32 heuristic, not
// a certified interval bound. Keep the isolated root when progress is unresolved.
float refineChart(vec4 a, vec4 b, vec4 c, float x, float level) {
  mat4 A = uP - mat4(level);
  mat4 absoluteA = mat4(abs(A[0]), abs(A[1]), abs(A[2]), abs(A[3]));
  for (int i = 0; i < 4; i++) {
    vec4 w = a + x * (b + x * c), aw = A * w;
    float f = dot(w, aw), df = 2. * dot(b + 2. * x * c, aw);
    float noise = 9.536743e-7 * dot(abs(w), absoluteA * abs(w));
    if (df == 0. || abs(f) <= noise)
      break;
    float next = x - f / df;
    if (next < 0. || next > 1. || next == x || abs(next - x) > .05 * max(x, 1e-6))
      break;
    vec4 nextW = a + next * (b + next * c);
    float nextF = dot(nextW, A * nextW);
    float nextNoise = 9.536743e-7 * dot(abs(nextW), absoluteA * abs(nextW));
    // Reject NaNs too: acceptance must be positively established.
    if (!(abs(nextF) + nextNoise < abs(f) - noise))
      break;
    x = next;
  }
  return x;
}
