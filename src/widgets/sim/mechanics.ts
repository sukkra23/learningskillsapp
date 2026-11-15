const rad = (deg: number) => (deg * Math.PI) / 180;

/** Projectile launched at `speed` and `angleDeg` from height h0, no air resistance. */
export function projectile(speed: number, angleDeg: number, h0: number, g: number) {
  const vx = speed * Math.cos(rad(angleDeg)), vy = speed * Math.sin(rad(angleDeg));
  const tFlight = (vy + Math.sqrt(vy * vy + 2 * g * h0)) / g;
  return { vx, vy, tFlight, range: vx * tFlight, maxHeight: h0 + (vy > 0 ? (vy * vy) / (2 * g) : 0), tApex: Math.max(0, vy / g),
    at: (t: number) => ({ x: vx * t, y: h0 + vy * t - 0.5 * g * t * t }) };
}

/** Constant-acceleration motion. */
export const kinematics = (x0: number, v0: number, a: number) => ({ x: (t: number) => x0 + v0 * t + 0.5 * a * t * t, v: (t: number) => v0 + a * t });

/** 1D collision with coefficient of restitution e (1 elastic, 0 perfectly inelastic). */
export function collide(m1: number, v1: number, m2: number, v2: number, e: number) {
  const p = m1 * v1 + m2 * v2, M = m1 + m2;
  const u1 = (p - m2 * e * (v1 - v2)) / M, u2 = (p + m1 * e * (v1 - v2)) / M;
  const ke = (a: number, b: number) => 0.5 * m1 * a * a + 0.5 * m2 * b * b;
  return { u1, u2, pBefore: p, pAfter: m1 * u1 + m2 * u2, keBefore: ke(v1, v2), keAfter: ke(u1, u2) };
}

/** Sum of forces given as [magnitude, angle in degrees]. */
export function netForce(forces: [number, number][]) {
  const fx = forces.reduce((s, [m, a]) => s + m * Math.cos(rad(a)), 0), fy = forces.reduce((s, [m, a]) => s + m * Math.sin(rad(a)), 0);
  return { fx, fy, magnitude: Math.hypot(fx, fy), angle: (Math.atan2(fy, fx) * 180) / Math.PI };
}

export type Vec4 = [number, number, number, number];
/** Double pendulum (unit masses m1, m2; lengths l1, l2). State = [theta1, omega1, theta2, omega2]. */
export function doublePendulumDeriv([t1, w1, t2, w2]: Vec4, m1 = 1, m2 = 1, l1 = 1, l2 = 1, g = 9.81): Vec4 {
  const d = t1 - t2, den = 2 * m1 + m2 - m2 * Math.cos(2 * d);
  const a1 = (-g * (2 * m1 + m2) * Math.sin(t1) - m2 * g * Math.sin(t1 - 2 * t2) - 2 * Math.sin(d) * m2 * (w2 * w2 * l2 + w1 * w1 * l1 * Math.cos(d))) / (l1 * den);
  const a2 = (2 * Math.sin(d) * (w1 * w1 * l1 * (m1 + m2) + g * (m1 + m2) * Math.cos(t1) + w2 * w2 * l2 * m2 * Math.cos(d))) / (l2 * den);
  return [w1, a1, w2, a2];
}
export function rk4<T extends number[]>(s: T, f: (s: T) => T, dt: number): T {
  const add = (a: T, b: T, k: number) => a.map((v, i) => v + k * b[i]) as T;
  const k1 = f(s), k2 = f(add(s, k1, dt / 2)), k3 = f(add(s, k2, dt / 2)), k4 = f(add(s, k3, dt));
  return s.map((v, i) => v + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])) as T;
}
export function doublePendulumEnergy([t1, w1, t2, w2]: Vec4, g = 9.81) {
  const ke = 0.5 * w1 * w1 + 0.5 * (w1 * w1 + w2 * w2 + 2 * w1 * w2 * Math.cos(t1 - t2));
  const pe = -g * Math.cos(t1) - g * (Math.cos(t1) + Math.cos(t2));
  return ke + pe;
}

/** One velocity-Verlet step for a body orbiting a fixed mass at the origin (GM = mu). Symplectic: energy stays bounded. */
export function orbitStep(s: { x: number; y: number; vx: number; vy: number }, mu: number, dt: number) {
  const acc = (x: number, y: number) => { const r3 = Math.hypot(x, y) ** 3; return [-mu * x / r3, -mu * y / r3]; };
  const [ax, ay] = acc(s.x, s.y);
  const x = s.x + s.vx * dt + 0.5 * ax * dt * dt, y = s.y + s.vy * dt + 0.5 * ay * dt * dt;
  const [bx, by] = acc(x, y);
  return { x, y, vx: s.vx + 0.5 * (ax + bx) * dt, vy: s.vy + 0.5 * (ay + by) * dt };
}
export const orbitEnergy = (s: { x: number; y: number; vx: number; vy: number }, mu: number) => 0.5 * (s.vx * s.vx + s.vy * s.vy) - mu / Math.hypot(s.x, s.y);

/** Infinite square well of width L: normalised stationary state n, and its energy in units of E1. */
export const boxPsi = (n: number, x: number, L = 1) => Math.sqrt(2 / L) * Math.sin((n * Math.PI * x) / L);
export const boxEnergy = (n: number) => n * n;
