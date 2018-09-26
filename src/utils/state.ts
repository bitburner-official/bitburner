import { BitBurner as NS } from 'bitburner';

const _update = Symbol('state:update');
const _reset = Symbol('state:reset');

type Updatable<T> = T & {
  [_update]: <R>(fn: (state: T) => R) => R;
  [_reset]: () => void;
};

const state = <T extends {}>(
  ns: NS,
  defaultState: T,
  owner: string = ns.getScriptName(),
): Updatable<T> => {
  const name = owner + '.state.json.txt';
  const writeState = (state: T) => {
    const json = JSON.stringify(state, null, 2);
    ns.write(name, json, 'w');
  };

  const readState = () => {
    if (!ns.fileExists(name)) {
      writeState(defaultState);
    }

    let json = ns.read(name);
    if (!json || json.trim().length === 0) {
      writeState(defaultState);
      json = ns.read(name);
    }

    let data: T;
    try {
      data = JSON.parse(json);
    } catch {
      writeState(defaultState);
      data = JSON.parse(JSON.stringify(defaultState));
    }

    return data;
  };

  const updateState = <R>(fn: (state: T) => R) => {
    const state = readState();
    const ret = fn(state);
    writeState(state);
    return ret;
  };

  const resetState = () => {
    writeState(defaultState);
  };

  const mkProxy = <T extends {}>(
    basePath: Array<string | number>,
    base: T,
  ): Updatable<T> =>
    new Proxy<Updatable<T>>(base as Updatable<T>, {
      get(_, property: string | number | typeof _update | typeof _reset) {
        if (property === _update) {
          return updateState;
        }

        if (property === _reset) {
          return resetState;
        }

        const path = [...basePath, property];
        let data: object = readState();
        for (const part of path) {
          if (data.hasOwnProperty(part)) {
            data = (data as any)[part];
          } else {
            throw new Error(
              `Object has no property '${part}' (part of '${path.join('.')}')`,
            );
          }
        }

        if (
          data === null ||
          typeof data === 'undefined' ||
          typeof data === 'number' ||
          typeof data === 'string' ||
          typeof data === 'boolean'
        )
          return data;

        return mkProxy(path, Array.isArray(data) ? [] : {});
      },

      set(_, property: string | number | symbol, value: any) {
        if (typeof property === 'symbol') {
          return false;
        }

        const path = [...basePath];
        let data: object = readState();
        for (const part of path) {
          if (data.hasOwnProperty(part)) {
            data = (data as any)[part];
          } else {
            throw new Error(
              `Object has no property '${part}' (part of '${path.join('.')}')`,
            );
          }
        }

        if (data && typeof data === 'object') {
          (data as any)[property] = value;
          return true;
        }

        return false;
      },
    });

  return mkProxy<T>([], {} as T);
};

export const update = <T, R>(updatable: Updatable<T>, fn: (state: T) => R) =>
  updatable[_update](fn);

export default state;
