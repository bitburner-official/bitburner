import { BitBurner as NS } from 'bitburner';

export type Logger = (
  literals: TemplateStringsArray,
  ...placeholders: any[]
) => void;

const formatters = new WeakMap<object, (o: any) => string>();
export const addFormatter = (proto: object, fn: (o: any) => string) =>
  formatters.set(proto, fn);

const getFormatter = (v: any): ((o: any) => string) | null => {
  if (v === null) return null;
  const formatter = formatters.get(v);
  return formatter || getFormatter(Object.getPrototypeOf(v));
};

const arg = (v: any) => {
  if (typeof v === 'undefined') return '<undefined>';
  if (v === null) return '<null>';
  const formatter = getFormatter(v);
  if (formatter) return formatter(v);
  if (typeof v.toLocaleString === 'function') return v.toLocaleString();
  return String(v);
};

const prettifyString = (
  literals: TemplateStringsArray,
  ...placeholders: any[]
) => {
  let result = '';
  for (let i = 0; i < placeholders.length; i++) {
    result += literals[i];
    result += arg(placeholders[i]);
  }

  // add the last literal
  result += literals[literals.length - 1];
  return result;
};

const maybeStr = (prefix?: string) =>
  typeof prefix === 'string' ? prefix : '';

export const createLogger = (ns: NS, prefix?: string): Logger => (
  literals: TemplateStringsArray,
  ...placeholders: any[]
) => ns.print(maybeStr(prefix) + prettifyString(literals, ...placeholders));
export const createTerminalLogger = (ns: NS, prefix?: string): Logger => (
  literals: TemplateStringsArray,
  ...placeholders: any[]
) => ns.tprint(maybeStr(prefix) + prettifyString(literals, ...placeholders));
