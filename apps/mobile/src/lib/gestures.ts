/**
 * Where a flick was heading: how far the finger would travel if it kept
 * slowing down at this rate (Apple's exponential decay). Lower rates stop
 * sooner, for decisions that shouldn't fire on a lazy release.
 */
export function project(velocity: number, decelerationRate = 0.998) {
  'worklet';
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Past an edge, the further you pull, the less it follows. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  'worklet';
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}
