// Andrew's Monotone Chain 2D Convex Hull Algorithm (identical to d3-polygon)

function lexicographic(a, b) {
  return a[0] - b[0] || a[1] - b[1];
}

function cross(o, a, b) {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

export function polygonHull(points) {
  if (!points || points.length < 3) return null;

  const pts = points
    .map(p => [Number(p[0]), Number(p[1])])
    .filter(p => !isNaN(p[0]) && !isNaN(p[1]));

  if (pts.length < 3) return null;

  pts.sort(lexicographic);

  // Lower hull
  const lower = [];
  for (let i = 0; i < pts.length; i++) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], pts[i]) <= 0) {
      lower.pop();
    }
    lower.push(pts[i]);
  }

  // Upper hull
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], pts[i]) <= 0) {
      upper.pop();
    }
    upper.push(pts[i]);
  }

  lower.pop();
  upper.pop();

  const hull = lower.concat(upper);
  return hull.length >= 3 ? hull : null;
}
