// Step-limited Newton refinement used as the experimental control.
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
