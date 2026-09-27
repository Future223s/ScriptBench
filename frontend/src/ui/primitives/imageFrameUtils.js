export function zoomImageView(current, amount, focalPoint = { x: 0, y: 0 }) {
  const nextScale = Math.max(
    1,
    Math.min(4, Number((Number(current.scale) + amount).toFixed(2))),
  );
  if (nextScale === Number(current.scale)) return current;
  if (nextScale === 1) return { scale: 1, x: 0, y: 0 };

  const ratio = nextScale / Number(current.scale);
  return {
    scale: nextScale,
    x: focalPoint.x - (focalPoint.x - Number(current.x)) * ratio,
    y: focalPoint.y - (focalPoint.y - Number(current.y)) * ratio,
  };
}
