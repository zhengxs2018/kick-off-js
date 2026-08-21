export function captureStack(_: Function, skipFrames = 0): string | undefined {
  const error = new Error();

  if (!error.stack) return undefined;

  const lines = error.stack.split('\n');
  const sliced = lines.slice(1 + skipFrames);

  return sliced.length > 0 ? sliced.join('\n') : undefined;
}
