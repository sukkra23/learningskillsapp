/** A 2-2-1 network with sigmoid activations and squared-error loss, small enough to follow by hand. */
export interface Net { w1: number[][]; b1: number[]; w2: number[]; b2: number }
export const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

export const initialNet = (): Net => ({ w1: [[0.5, -0.4], [0.3, 0.8]], b1: [0.1, -0.2], w2: [0.7, -0.6], b2: 0.05 });

export function forward(net: Net, x: number[]) {
  const z1 = net.w1.map((row, j) => row[0] * x[0] + row[1] * x[1] + net.b1[j]);
  const h = z1.map(sigmoid);
  const z2 = net.w2[0] * h[0] + net.w2[1] * h[1] + net.b2;
  return { z1, h, z2, y: sigmoid(z2) };
}
export const loss = (net: Net, x: number[], target: number) => 0.5 * (forward(net, x).y - target) ** 2;

/** Gradients of the loss with respect to every weight and bias, by the chain rule. */
export function backward(net: Net, x: number[], target: number) {
  const f = forward(net, x);
  const dOut = (f.y - target) * f.y * (1 - f.y);          // dL/dz2
  const dHidden = net.w2.map((w, j) => dOut * w * f.h[j] * (1 - f.h[j])); // dL/dz1_j
  return { f, dOut, dHidden, w2: f.h.map((h) => dOut * h), b2: dOut, w1: dHidden.map((d) => [d * x[0], d * x[1]]), b1: dHidden };
}

export function sgdStep(net: Net, x: number[], target: number, lr: number): Net {
  const g = backward(net, x, target);
  return {
    w1: net.w1.map((row, j) => row.map((w, i) => w - lr * g.w1[j][i])), b1: net.b1.map((b, j) => b - lr * g.b1[j]),
    w2: net.w2.map((w, j) => w - lr * g.w2[j]), b2: net.b2 - lr * g.b2,
  };
}
