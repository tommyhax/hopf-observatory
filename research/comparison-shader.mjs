/** Specialize the small derivative arrays at compile time for GLSL drivers. */
export function specializeYuksel(source) {
  const begin = '// BEGIN DEGREE SPECIALIZATION\n';
  const end = '// END DEGREE SPECIALIZATION';
  const start = source.indexOf(begin),
    finish = source.indexOf(end);
  if (start < 0 || finish <= start) throw Error('Missing Yuksel specialization markers');
  const body = source.slice(start + begin.length, finish);
  return (
    source.slice(0, start) +
    [2, 3, 4]
      .map((n) => body.replaceAll('Y_DEGREE', String(n)).replaceAll('yRootsDegree', `yRoots${n}`))
      .join('\n') +
    source.slice(finish + end.length)
  );
}
