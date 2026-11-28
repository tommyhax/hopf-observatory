// Generated from web/shader.js; fragment SHA256 3a70927462b5ad47092c5a3e73cfa5a668b6b83043be4d7a05427d8bc6fa8d32
double side(vec3 p, double level) {
  // Normalized by (1+r²)² to avoid overflow far from the origin.
  double r = dot(p, p);
  vec4 q = vec4(2. * p, r - 1.) / (1. + r);
  return dot(q, (uP - mat4(level)) * q);
}
vec3 normalAt(vec3 p, double level) {
  // Analytic gradient with a positive (1+r²) scale divided out.
  double r = dot(p, p);
  vec4 q = vec4(2. * p, r - 1.) / (1. + r), aq = (uP - mat4(level)) * q;
  return normalize(aq.xyz() + p * aq.w);
}
// One boundary for a solid torus, two independent quartics for a shell.
// The shell is cLow < q^T P q < cHigh. Its two outward normals have
// opposite signs relative to the gradient of q^T P q.
bool inMaterial(vec3 p) {
  return uShell == 1 ? side(p, uShellLow) > 0. && side(p, uShellHigh) < 0. : side(p, uC) > 0.;
}
double boundaryHit(vec3 o, vec3 d, double& level, double& normalSign) {
  level = uC;
  normalSign = -1.;
  if (uShell == 0)
    return intersection(o, d, level);
  double lowHit = intersection(o, d, uShellLow), highHit = intersection(o, d, uShellHigh);
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
double objectLevel(int i) {
  return uCount == 0 ? uC : uLevels[i];
}
double lowLevel(int i) {
  return uCount == 0 ? uShellLow : uLows[i];
}
double highLevel(int i) {
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
  double width = 2.;
  for (int i = 0; i < 3; i++) {
    if (i >= objectCount())
      break;
    if ((mask & (1 << i)) == 0)
      continue;
    double w = isShell(i) ? highLevel(i) - lowLevel(i) : 1. - objectLevel(i);
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
bool aboveBoundary(double level, double boundary, bool increasing) {
  return abs(level - boundary) < 2e-7 ? increasing : level > boundary;
}
// Resolve simultaneous/coincident boundary crossings in level space, without
// relying on a positional offset that could leap over another thin wall.
int maskAcross(double level, bool increasing) {
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
double sceneHit(vec3 o, vec3 d, double& level, double& normalSign, int& id) {
  double best = -1.;
  level = 0.;
  normalSign = -1.;
  id = -1;
  for (int i = 0; i < 3; i++) {
    if (i >= objectCount())
      break;
    if (!enabled(i))
      continue;
    double lo = isShell(i) ? lowLevel(i) : objectLevel(i), s = intersection(o, d, lo);
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
double line(double x, double width) {
  return 1. - smoothstep(width, width * 2., abs(fract(x + .5) - .5));
}
vec3 rotateY(vec3 d, double a) {
  double c = cos(a), s = sin(a);
  return vec3(c * d.x + s * d.z, d.y, -s * d.x + c * d.z);
}
vec3 environmentRaw(vec3 d, double lod) {
  d = rotateY(d, uEnvRotation);
  double az = atan(d.z, d.x) / PI, el = asin(clamp(d.y, -1., 1.)) / PI;
  if (uEnvironment == 6) {
    vec2 uv = vec2(fract(az * .5 + .5), .5 - el);
    return pow(max(textureLod(uEnvironmentMap, uv, lod).xyz(), vec3(0)), vec3(2.2));
  }
  double h = smoothstep(-.45, .75, d.y);
  vec3 col = mix(vec3(.012, .026, .038), vec3(.055, .09, .13), h);
  if (uEnvironment == 1)
    col = mix(vec3(.18, .22, .26), vec3(.5, .58, .62), h);
  double grid = max(line(az * 12., .008), line(el * 12., .008));
  col += vec3(.09, .16, .19) * grid * .30;
  col += vec3(.20, .34, .37) * exp(-abs(d.y + .12) * 38.) * .28;
  if (d.y < -.13) {
    vec2 p = d.xz() / (-d.y + .08);
    double checker = mod(floor(p.x * 1.8) + floor(p.y * 1.8), 2.);
    col += mix(vec3(.015, .026, .033), vec3(.07, .10, .115), checker) * smoothstep(.04, .45, -d.y);
  }
  double warm = pow(max(0., dot(d, normalize(vec3(-.8, .3, -1.)))), 64.);
  double cool = pow(max(0., dot(d, normalize(vec3(1., .45, .3)))), 85.);
  col += vec3(3.6, 2.3, .9) * warm + vec3(.4, 1.8, 2.8) * cool;
  col += vec3(.8, 1.55, 1.65) * exp(-pow((az - .40) * 95., 2.)) * smoothstep(-.3, .0, d.y) *
         (1. - smoothstep(.65, .85, d.y));
  if (uEnvironment == 2)
    col = vec3(.035, .047, .06) + vec3(.22, .29, .35) * grid + vec3(1.7, .72, .18) * warm +
          vec3(.12, .7, 1.4) * cool;
  if (uEnvironment == 3) {
    col = mix(vec3(.035), vec3(.17, .19, .22), h);
    double ceiling = smoothstep(.55, .65, d.y);
    double box1 =
        (1. - smoothstep(.20, .23, abs(az + .32))) * (1. - smoothstep(.25, .28, abs(el - .12)));
    double box2 =
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
    double wall = pow(max(0., 1. - abs(d.y)), 3.);
    double windows = line(az * 8., .12) * (1. - smoothstep(.18, .25, abs(el - .10)));
    col += vec3(.7, .9, 1.2) * windows * wall;
    col += vec3(.35, .16, .07) * line(az * 4. + .2, .035) * wall;
    if (d.y > .6)
      col += vec3(.4, .5, .65);
    if (d.y < -.1) {
      vec2 p = d.xz() / max(.1, -d.y);
      col += vec3(.2) * mod(floor(p.x) + floor(p.y), 2.);
    }
  }
  return col;
}
vec3 environment(vec3 d) {
  return exp2(uExposure) * environmentRaw(d, 0.);
}
vec3 roughEnvironment(vec3 d, double roughness) {
  if (roughness < .015)
    return environment(d);
  if (uEnvironment == 6)
    return exp2(uExposure) * environmentRaw(d, roughness * uMapMaxLod);
  vec3 a = normalize(cross(d, abs(d.y) < .9 ? vec3(0, 1, 0) : vec3(1, 0, 0))), b = cross(d, a);
  double spread = roughness * roughness * .65;
  return exp2(uExposure) *
         (.4 * environmentRaw(d, 0.) + .15 * (environmentRaw(normalize(d + spread * a), 0.) +
                                              environmentRaw(normalize(d - spread * a), 0.) +
                                              environmentRaw(normalize(d + spread * b), 0.) +
                                              environmentRaw(normalize(d - spread * b), 0.)));
}
double fresnel(double ci, double n1, double n2) {
  double st2 = (n1 / n2) * (n1 / n2) * (1. - ci * ci);
  if (st2 >= 1.)
    return 1.;
  double ct = sqrt(max(0., 1. - st2));
  double rs = (n1 * ci - n2 * ct) / max(1e-7, n1 * ci + n2 * ct);
  double rp = (n1 * ct - n2 * ci) / max(1e-7, n1 * ct + n2 * ci);
  return .5 * (rs * rs + rp * rp);
}
vec3 surfaceLight(vec3 p, vec3 n, vec3 d, int id) {
  vec3 base = colorAt(id), light = rotateY(normalize(vec3(-3., 5., 4.)), -uEnvRotation);
  double roughness = optics(id).z, dif = max(0., dot(n, light));
  vec3 halfv = normalize(light - d);
  double spec = pow(max(0., dot(n, halfv)), mix(180., 6., roughness));
  return base * (.12 + .65 * dif + .18 * roughEnvironment(n, .6)) +
         vec3(1.7, 1.6, 1.45) * spec * .35;
}
vec3 absorption(int id, double distance) {
  if (id < 0)
    return vec3(1);
  return exp(-(vec3(1) - colorAt(id)) * .65 * optics(id).x * min(distance, 30.));
}
vec3 metalFresnel(vec3 base, double ci) {
  return base + (vec3(1) - base) * pow(1. - ci, 5.);
}
// Secondary reflection paths use all scene boundaries too; tertiary branches
// resolve to the environment to keep the work bounded on WebGL hardware.
vec3 reflectionPath(vec3 o, vec3 d, double roughness) {
  vec3 light = vec3(0), weight = vec3(1);
  int mask = materialMask(o);
  for (int j = 0; j < 4; j++) {
    double level, sign;
    int id;
    double s = sceneHit(o, d, level, sign, id);
    if (s < 0.)
      break;
    int before = mediumFor(mask);
    vec3 p = o + s * d, g = normalAt(p, level), n = dot(d, g) < 0. ? g : -g;
    double eps = rayEpsilon(p);
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
    double ci = clamp(dot(-d, n), 0., 1.);
    if (mat.w > .5) {
      weight *= metalFresnel(colorAt(surface), ci);
      o = p + n * eps;
      d = r;
      roughness = mat.z;
      continue;
    }
    double n1 = optics(before).y, n2 = optics(after).y, F = fresnel(ci, n1, n2);
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
  double roughness = 0.;
  for (int bounce = 0; bounce < 24; bounce++) {
    if (bounce >= uBounces)
      break;
    double level, sign;
    int id;
    double s = sceneHit(o, d, level, sign, id);
    int before = mediumFor(mask);
    if (s < 0.)
      return radiance + throughput * absorption(before, 12.) * roughEnvironment(d, roughness);
    vec3 p = o + s * d, g = normalAt(p, level), outward = sign * g, n = dot(g, d) < 0. ? g : -g;
    if (uMode == 1)
      return .5 + .5 * outward;
    if (uMode == 2) {
      double bands = .5 + .5 * cos(log(1. + s) * 12.);
      return mix(vec3(.035, .15, .19), vec3(.7, .87, .65), bands);
    }
    double eps = rayEpsilon(p);
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
    double ci = clamp(dot(-d, n), 0., 1.);
    vec3 reflected = reflect(d, n);
    if (mat.w > .5) {
      throughput *= metalFresnel(colorAt(surface), ci);
      o = p + n * eps;
      d = reflected;
      roughness = mat.z;
      continue;
    }
    double n1 = optics(before).y, n2 = optics(after).y, F = fresnel(ci, n1, n2);
    vec3 transmitted = refract(d, n, n1 / n2);
    bool tir = dot(transmitted, transmitted) < 1e-10;
    
if (debugStep == bounce) {
  captured = {p.x,p.y,p.z,s,double(before),double(after),n1,n2,
              transmitted.x,transmitted.y,transmitted.z,tir?1.:0.,n.x,n.y,n.z,level};
  return radiance;
}
    radiance += throughput * mat.x * surfaceLight(p, n, d, surface);
    throughput *= 1. - mat.x;
    if (max(throughput.x, max(throughput.y, throughput.z)) < .006)
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
