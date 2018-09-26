import { BitBurner as NS, Script } from 'bitburner';
import { Server, fileExists, getFreeServerRam, getHostname } from './server';

const _script = Symbol('tool:script');
const _ns = Symbol('ns');

export class Tool {
  public readonly [_script]: Script;
  public readonly [_ns]: NS;

  constructor(ns: NS, script: Script) {
    if (!ns.fileExists(script, 'home')) {
      throw new Error(`Tool ${script} does not exist on home`);
    }

    this[_script] = script;
    this[_ns] = ns;

    Object.freeze(this);
  }
}

export const toolCost = (tool: Tool, threads: number = 1) => {
  if (threads <= 0) {
    throw new Error(`Threads must be a positive number`);
  }

  return tool[_ns].getScriptRam(tool[_script], 'home') * threads;
};

export const maxThreads = (tool: Tool, server: Server) => {
  const freeRam = getFreeServerRam(server);
  const cost = tool[_ns].getScriptRam(tool[_script], 'home');
  return Math.floor(freeRam / cost);
};

export const runTool = async (
  tool: Tool,
  server: Server,
  threads: number,
  args: ReadonlyArray<string>,
) => {
  if (!fileExists(server, tool[_script])) {
    tool[_ns].scp(tool[_script], 'home', getHostname(server));
  }

  return await tool[_ns].exec(
    tool[_script],
    getHostname(server),
    threads,
    ...args,
  );
};
