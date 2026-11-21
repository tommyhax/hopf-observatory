// Shared shader compilation and uniform binding for browser experiments.
export function compileProgram(gl, vertex, fragment) {
  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw Error(message);
    }
    return shader;
  };
  const program = gl.createProgram();
  const shaders = [compile(gl.VERTEX_SHADER, vertex), compile(gl.FRAGMENT_SHADER, fragment)];
  shaders.forEach((shader) => gl.attachShader(program, shader));
  gl.linkProgram(program);
  shaders.forEach((shader) => gl.deleteShader(shader));
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  const uniforms = new Map();
  for (let i = 0; i < gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS); i++) {
    const item = gl.getActiveUniform(program, i);
    uniforms.set(item.name, {
      type: item.type,
      location: gl.getUniformLocation(program, item.name),
    });
  }
  return {
    program,
    set(values) {
      for (const [name, value] of Object.entries(values)) {
        const item = uniforms.get(name);
        if (!item) continue;
        const { type, location } = item;
        switch (type) {
          case gl.FLOAT:
            gl.uniform1f(location, value);
            break;
          case gl.INT:
          case gl.SAMPLER_2D:
            gl.uniform1i(location, value);
            break;
          case gl.FLOAT_VEC2:
            gl.uniform2fv(location, value);
            break;
          case gl.FLOAT_VEC3:
            gl.uniform3fv(location, value);
            break;
          case gl.FLOAT_VEC4:
            gl.uniform4fv(location, value);
            break;
          case gl.INT_VEC3:
            gl.uniform3iv(location, value);
            break;
          case gl.FLOAT_MAT4:
            gl.uniformMatrix4fv(location, false, value);
            break;
          default:
            throw Error(`Unsupported uniform type for ${name}`);
        }
      }
    },
  };
}
export async function sourceHashes(paths) {
  const pairs = await Promise.all(
    paths.map(async (path) => {
      const response = await fetch(path);
      if (!response.ok) throw Error(`Cannot read source: ${path}`);
      const digest = await crypto.subtle.digest('SHA-256', await response.arrayBuffer());
      return [
        path,
        [...new Uint8Array(digest)].map((x) => x.toString(16).padStart(2, '0')).join(''),
      ];
    }),
  );
  return Object.fromEntries(pairs);
}
