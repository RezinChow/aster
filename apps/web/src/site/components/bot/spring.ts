/** Minimal critically-damped-ish spring for character motion. */

export type Spring = {
  value: number;
  target: number;
  velocity: number;
  stiffness: number;
  damping: number;
};

export function spring(
  value = 0,
  stiffness = 180,
  damping = 18,
): Spring {
  return { value, target: value, velocity: 0, stiffness, damping };
}

export function setSpring(s: Spring, target: number, hard = false) {
  s.target = target;
  if (hard) {
    s.value = target;
    s.velocity = 0;
  }
}

export function stepSpring(s: Spring, dt: number) {
  const maxDt = Math.min(dt, 1 / 30);
  const force = (s.target - s.value) * s.stiffness - s.velocity * s.damping;
  s.velocity += force * maxDt;
  s.value += s.velocity * maxDt;
  if (
    Math.abs(s.target - s.value) < 0.0004 &&
    Math.abs(s.velocity) < 0.0004
  ) {
    s.value = s.target;
    s.velocity = 0;
  }
  return s.value;
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}
