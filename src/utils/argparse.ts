import { BitBurner as NS } from 'bitburner';

export interface Opts {
  /**
   * A string or array of strings argument names to always treat as strings
   */
  string?: string | string[];

  /**
   * A boolean, string or array of strings to always treat as booleans. If true will treat
   * all double hyphenated arguments without equals signs as boolean (e.g. affects `--foo`, not `-f` or `--foo=bar`)
   */
  boolean?: boolean | string | string[];

  /**
   * An object mapping string names to strings or arrays of string argument names to use as aliases
   */
  alias?: { [key: string]: string | string[] };

  /**
   * An object mapping string argument names to default values
   */
  default?: { [key: string]: any };

  /**
   * When true, populate argv._ with everything after the first non-option
   */
  stopEarly?: boolean;

  /**
   * A function which is invoked with a command line parameter not defined in the opts
   * configuration object. If the function returns false, the unknown option is not added to argv
   */
  unknown?: (arg: string) => boolean;

  /**
   * When true, populate argv._ with everything before the -- and argv['--'] with everything after the --.
   * Note that with -- set, parsing for arguments still stops after the `--`.
   */
  '--'?: boolean;
}

export interface ParsedArgs {
  [arg: string]: any;

  /**
   * If opts['--'] is true, populated with everything after the --
   */
  '--'?: string[];

  /**
   * Contains all the arguments that didn't have an option associated with them
   */
  _: string[];
}

const CONTROL =
  '(?:' + ['\\|\\|', '\\&\\&', ';;', '\\|\\&', '[&;()|<>]'].join('|') + ')';
const META = '|&;()<> \\t';
const BAREWORD = '(\\\\[\'"' + META + ']|[^\\s\'"' + META + '])+';
const SINGLE_QUOTE = '"((\\\\"|[^"])*?)"';
const DOUBLE_QUOTE = "'((\\\\'|[^'])*?)'";

const shellParse = (args: ReadonlyArray<string>): ReadonlyArray<string> => {
  const s = args.join(' ');
  const chunker = new RegExp(
    [
      '(' + CONTROL + ')', // control chars
      '(' + BAREWORD + '|' + SINGLE_QUOTE + '|' + DOUBLE_QUOTE + ')*',
    ].join('|'),
    'g',
  );
  const maybeMatch: ReadonlyArray<string> | null = s.match(chunker);

  if (!maybeMatch) return [];
  const match = maybeMatch.filter(Boolean);

  return match.map((s, j) => {
    // Hand-written scanner/parser for Bash quoting rules:
    //
    //  1. inside single quotes, all characters are printed literally.
    //  2. inside double quotes, all characters are printed literally
    //     except variables prefixed by '$' and backslashes followed by
    //     either a double quote or another backslash.
    //  3. outside of any quotes, backslashes are treated as escape
    //     characters and not printed (unless they are themselves escaped)
    //  4. quote context can switch mid-token if there is no whitespace
    //     between the two quote contexts (e.g. all'one'"token" parses as
    //     "allonetoken")
    const SQ = "'";
    const DQ = '"';
    const BS = '\\';
    let quote: false | string = false;
    let esc = false;
    let out = '';

    for (let i = 0, len = s.length; i < len; i++) {
      let c = s.charAt(i);
      if (esc) {
        out += c;
        esc = false;
      } else if (quote) {
        if (c === quote) {
          quote = false;
        } else if (quote == SQ) {
          out += c;
        } else {
          // Double quote
          if (c === BS) {
            i += 1;
            c = s.charAt(i);
            if (c === DQ || c === BS) {
              out += c;
            } else {
              out += BS + c;
            }
          } else {
            out += c;
          }
        }
      } else if (c === DQ || c === SQ) {
        quote = c;
      } else if (c === BS) {
        esc = true;
      } else {
        out += c;
      }
    }

    return out;
  });
};

const isNumber = (x: unknown) => {
  if (typeof x === 'number') return true;
  if (/^0x[0-9a-f]+$/i.test(String(x))) return true;
  return /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(e[-+]?\d+)?$/.test(String(x));
};

const hasKey = (obj: any, keys: ReadonlyArray<string>) => {
  let o = obj;
  keys.slice(0, -1).forEach(key => {
    o = o[key] || {};
  });

  const key = keys[keys.length - 1];
  return Object.prototype.hasOwnProperty.call(o, key);
};

export const parseArgs = (ns: NS, opts: Opts = {}) => {
  let args = shellParse(ns.args);
  const flags: {
    allBools: boolean;
    bools: { [name: string]: true | undefined };
    strings: { [name: string]: true | undefined };
    unknownFn: ((arg: string) => boolean) | null;
  } = { allBools: false, bools: {}, strings: {}, unknownFn: null };

  const { unknown, boolean } = opts;
  if (typeof unknown === 'function') {
    flags.unknownFn = unknown;
  }
  const aliases: { [name: string]: ReadonlyArray<string> } = {};
  Object.keys(opts.alias || {}).forEach(key => {
    aliases[key] = ([] as ReadonlyArray<string>).concat(opts.alias![key]);
    aliases[key].forEach(x => {
      aliases[x] = [key].concat(aliases[key].filter(y => x !== y));
    });
  });

  if (typeof boolean === 'boolean' && boolean) {
    flags.allBools = true;
  } else {
    ([] as ReadonlyArray<string>)
      .concat(boolean as ReadonlyArray<string>)
      .filter(Boolean)
      .forEach(key => {
        flags.bools[key] = true;
        (aliases[key] || []).forEach(alias => {
          flags.bools[alias] = true;
        });
      });
  }

  ([] as ReadonlyArray<string>)
    .concat(opts.string!)
    .filter(Boolean)
    .forEach(key => {
      flags.strings[key] = true;
      (aliases[key] || []).forEach(alias => {
        flags.strings[alias] = true;
      });
    });

  const defaults = opts['default'] || {};

  const argDefined = (key: string, arg: string) =>
    (flags.allBools && /^--[^=]+$/.test(arg)) ||
    flags.strings[key] ||
    flags.bools[key] ||
    aliases[key];

  const setKey = (
    obj: ParsedArgs,
    keys: ReadonlyArray<string>,
    value: unknown,
  ) => {
    let o = obj;
    keys.slice(0, -1).forEach(key => {
      if (typeof o[key] === 'undefined') o[key] = {};
      o = o[key];
    });

    const key = keys[keys.length - 1];
    if (
      typeof o[key] === 'undefined' ||
      flags.bools[key] ||
      typeof o[key] === 'boolean'
    ) {
      o[key] = value;
    } else if (Array.isArray(o[key])) {
      o[key].push(value);
    } else {
      o[key] = [o[key], value];
    }
  };

  const setArg = (key: string, val: unknown, arg?: string) => {
    if (arg && flags.unknownFn && !argDefined(key, arg)) {
      if (flags.unknownFn(arg) === false) return;
    }

    var value = !flags.strings[key] && isNumber(val) ? Number(val) : val;
    setKey(argv, key.split('.'), value);

    (aliases[key] || []).forEach(function(x) {
      setKey(argv, x.split('.'), value);
    });
  };

  var argv: ParsedArgs = { _: [] };
  Object.keys(flags.bools).forEach(key => {
    setArg(key, defaults[key] === undefined ? false : defaults[key]);
  });

  let notFlags: ReadonlyArray<string> = [];

  if (args.indexOf('--') !== -1) {
    notFlags = args.slice(args.indexOf('--') + 1);
    args = args.slice(0, args.indexOf('--'));
  }

  for (var i = 0; i < args.length; i++) {
    var arg = args[i];

    if (/^--.+=/.test(arg)) {
      // Using [\s\S] instead of . because js doesn't support the
      // 'dotall' regex modifier. See:
      // http://stackoverflow.com/a/1068308/13216
      const m = arg.match(/^--([^=]+)=([\s\S]*)$/)!;
      const key = m[1];
      let value: unknown = m[2];
      if (flags.bools[key]) {
        value = value !== 'false';
      }
      setArg(key, value, arg);
    } else if (
      /^--no-.+/.test(arg) &&
      flags.bools[arg.match(/^--no-(.+)/)![1]]
    ) {
      const key = arg.match(/^--no-(.+)/)![1];
      setArg(key, false, arg);
    } else if (/^--.+/.test(arg)) {
      var key = arg.match(/^--(.+)/)![1];
      var next = args[i + 1];
      if (
        next !== undefined &&
        !/^-/.test(next) &&
        !flags.bools[key] &&
        !flags.allBools
      ) {
        setArg(key, next, arg);
        i++;
      } else if (/^(true|false)$/.test(next)) {
        setArg(key, next === 'true', arg);
        i++;
      } else {
        setArg(key, flags.strings[key] ? '' : true, arg);
      }
    } else if (/^-[^-]+/.test(arg)) {
      var letters = arg.slice(1, -1).split('');

      var broken = false;
      for (var j = 0; j < letters.length; j++) {
        var next = arg.slice(j + 2);

        if (next === '-') {
          setArg(letters[j], next, arg);
          continue;
        }

        if (/[A-Za-z]/.test(letters[j]) && /=/.test(next)) {
          setArg(letters[j], next.split('=')[1], arg);
          broken = true;
          break;
        }

        if (
          /[A-Za-z]/.test(letters[j]) &&
          /-?\d+(\.\d*)?(e-?\d+)?$/.test(next)
        ) {
          setArg(letters[j], next, arg);
          broken = true;
          break;
        }

        if (letters[j + 1] && letters[j + 1].match(/\W/)) {
          setArg(letters[j], arg.slice(j + 2), arg);
          broken = true;
          break;
        } else {
          setArg(letters[j], flags.strings[letters[j]] ? '' : true, arg);
        }
      }

      var key = arg.slice(-1)[0];
      if (!broken && key !== '-') {
        if (
          args[i + 1] &&
          !/^(-|--)[^-]/.test(args[i + 1]) &&
          !flags.bools[key]
        ) {
          setArg(key, args[i + 1], arg);
          i++;
        } else if (args[i + 1] && /true|false/.test(args[i + 1])) {
          setArg(key, args[i + 1] === 'true', arg);
          i++;
        } else {
          setArg(key, flags.strings[key] ? '' : true, arg);
        }
      }
    } else {
      if (!flags.unknownFn || flags.unknownFn(arg) !== false) {
        argv._.push(arg);
      }
      if (opts.stopEarly) {
        argv._.push.apply(argv._, args.slice(i + 1));
        break;
      }
    }
  }

  Object.keys(defaults).forEach(function(key) {
    if (!hasKey(argv, key.split('.'))) {
      setKey(argv, key.split('.'), defaults[key]);

      (aliases[key] || []).forEach(function(x) {
        setKey(argv, x.split('.'), defaults[key]);
      });
    }
  });

  if (opts['--']) {
    argv['--'] = [];
    notFlags.forEach(function(key) {
      argv['--']!.push(key);
    });
  } else {
    notFlags.forEach(function(key) {
      argv._.push(key);
    });
  }

  return argv;
};
