// Assemble a research-only optical renderer without editing the production shader.
import { readFile } from 'node:fs/promises';
import { replaceFunction } from '../../renderer-variants.mjs';

export const variantFiles = [
  'research/diagnostics/algorithm1010/solver.glsl',
  'research/diagnostics/algorithm1010/renderer.mjs',
  'research/diagnostics/algorithm1010/run-suite.mjs',
  'research/yuksel-renderer.glsl',
  'research/renderer-variants.mjs',
];
function replaceOnce(source, before, after) {
  if (source.split(before).length !== 2) throw Error('Non-unique replacement: ' + before);
  return source.replace(before, after);
}
export async function rendererVariant(source, name) {
  if (name === 'production') return source;
  if (!['odm-direct', 'odm-charts'].includes(name)) throw Error('Unknown variant ' + name);
  const solver = await readFile(new URL('solver.glsl', import.meta.url), 'utf8');
  let backend = await readFile(new URL('../../yuksel-renderer.glsl', import.meta.url), 'utf8');
  backend = backend.replaceAll('yuksel', 'odm');
  const solve = `vec4 candidates;
    int count = oQuartic(vec4(p[0],p[1],p[2],p[3]),p[4],candidates);
    for(int i=0;i<4;++i) roots[i]=i<count?candidates[i]:Y_NO_ROOT;
    roots[4]=Y_NO_ROOT;`;
  backend = replaceOnce(backend, '  yRoots(p, 0., 1., roots);', solve);
  backend = replaceOnce(
    backend,
    `  float bound = yBound(p);
  if (isinf(bound) || isnan(bound))
    return -1.;
  yRoots(p, -bound, bound, roots);`,
    solve,
  );
  backend = replaceOnce(
    backend,
    '    if (roots[i] == Y_NO_ROOT)\n      continue;',
    '    if (!(roots[i] >= 0. && roots[i] <= 1.))\n      continue;',
  );
  const insertion = source.indexOf('float chartIntersection(');
  if (insertion < 0) throw Error('Missing chart insertion point');
  source =
    source.slice(0, insertion) +
    solver +
    '\nconst float Y_NO_ROOT=3.4e38;\n' +
    backend +
    source.slice(insertion);
  source =
    name === 'odm-direct'
      ? replaceFunction(
          source,
          'intersection',
          'float intersection(vec3 o,vec3 d,float level){return odmDirectIntersection(o,d,level);}',
        )
      : replaceFunction(
          source,
          'chartIntersection',
          'float chartIntersection(vec3 center,vec3 direction,float L,float k,float sign,bool farChart,float minS,float level){return odmChartIntersection(center,direction,L,k,sign,farChart,minS,level);}',
        );
  // On the native Metal stack, some IDs/levels are mis-associated when the
  // large factorization backend is nested inside the dynamic scene loop.
  // Expand its fixed three iterations, preserving order, hit tests and optics.
  // The diagnostic retains the initial failures and verifies the workaround.
  const scene = `float sceneHit(vec3 o,vec3 d,out float level,out float normalSign,out int id){
    float best=-1.;level=0.;normalSign=-1.;id=-1;
    ${[0, 1, 2]
      .map(
        (i) => `
    if(${i}<objectCount()&&enabled(${i})) {
      float lo=isShell(${i})?lowLevel(${i}):objectLevel(${i});
      float s=intersection(o,d,lo);
      if(s>=0.&&(best<0.||s<best)){best=s;level=lo;normalSign=-1.;id=${i};}
      if(isShell(${i})) {
        float hi=highLevel(${i});s=intersection(o,d,hi);
        if(s>=0.&&(best<0.||s<best)){best=s;level=hi;normalSign=1.;id=${i};}
      }
    }`,
      )
      .join('\n')}
    return best;
  }`;
  return replaceFunction(source, 'sceneHit', scene);
}
