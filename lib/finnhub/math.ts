import "server-only";

/** Round a number to 2 decimal places (standard financial display precision). */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
