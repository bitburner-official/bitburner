import { BitBurner as NS } from 'bitburner';

export type Logger = (
  literals: TemplateStringsArray,
  ...placeholders: any[]
) => void;

const arg = (v: any) => {
  if (typeof v === 'undefined') return '<undefined>';
  if (v === null) return '<null>';
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
