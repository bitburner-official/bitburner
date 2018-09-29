interface Pipe {
  <A, B, C>(f: (a: A) => B, g: (b: B) => C): (a: A) => C;
  <A, B, C, D>(f: (a: A) => B, g: (b: B) => C, h: (c: C) => D): (a: A) => D;
}

export const pipe: Pipe = (...fns: Array<Function>) => (v: any) =>
  fns.reduce((v, f) => f(v), v);
