import { pipe } from './functions';

interface IFormatable<Opts> {
  toLocaleString(locale: 'en-us', opts: Opts): string;
}

type FormattingOptions<T> = T extends IFormatable<infer K> ? K : never;

export type Formatter<T> = (value: T) => string;
export const format = <T extends IFormatable<any>>(
  opts: FormattingOptions<T>,
): Formatter<T> => (v: T) => v.toLocaleString('en-us', opts);

const append = (s: string) => (v: string) => v + s;

export const fNumber = format<number>({});
export const fMoney = format<number>({
  style: 'currency',
  currency: 'USD',
});
export const fRam: Formatter<number> = pipe(
  format<number>({}),
  append('GB'),
);
