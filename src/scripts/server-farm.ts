import {
  HackStatus,
  Server,
  fileExists,
  getAvailableMoney,
  getBaseSecurityLevel,
  getFreeServerRam,
  getGrowth,
  getHackStatus,
  getHostname,
  getMaxMoney,
  getMinSecurityLevel,
  getSecurityLevel,
  getServerRam,
  getWeakenTime,
  hasRootAccess,
  runningProcesses,
} from '../core/server';
import { Host, BitBurner as NS, Script } from 'bitburner';
import { Investor, getBudget, tryInvest } from '../utils/investor';
import { Logger, createLogger, createTerminalLogger } from '../utils/print';
import { flattenNetwork, scanNetwork } from '../utils/network';

import mkState from '../utils/state';
import { orderBy } from '../utils/array';

// --- CONSTANTS ---
// track how costly (in security) a growth/hacking thread is.
const GROWTH_THREAD_HARDENING = 0.004;
const HACK_THREAD_HARDENING = 0.002;

// initial potency of weaken threads before multipliers
const WEAKEN_THREAD_POTENCY = 0.05;

// unadjusted server growth rate, this is way more than what you actually get
const UNAJUSTED_GROWTH_RATE = 1.03;

// max server growth rate, growth rates higher than this are throttled.
const MAX_GROWTH_RATE = 1.0035;

// the number of milliseconds to delay the grow execution after theft, for timing reasons
// the delay between each step should be *close* 1/4th of this number, but there is some imprecision
const ARBITRARY_EXECUTION_DELAY = 12000;

// the delay that it can take for a script to start, used to pessimistically schedule things in advance
const QUEUE_DELAY = 12000;

// the max number of batches this daemon will spool up to avoid running out of IRL ram
const MAX_BATCHES = 60;

// the max number of targets this daemon will run workers against to avoid running out of IRL ram
const MAX_TARGETS = 5;

// minimum and maximum ram exponents to purchase servers with.
const MIN_RAM_EXPONENT = 4; // 16GB
const MAX_RAM_EXPONENT = 20; // 2^20 GB

// scripts to copy to all managed servers
const WEAKEN_TOOL_NAME = 'weak-target.js';
const GROW_TOOL_NAME = 'grow-target.js';
const HACK_TOOL_NAME = 'hack-target.js';
const TOOL_NAMES: ReadonlyArray<string> = Object.freeze([
  WEAKEN_TOOL_NAME,
  GROW_TOOL_NAME,
  HACK_TOOL_NAME,
]);
const SCRIPT_FILES: ReadonlyArray<string> = Object.freeze([
  ...TOOL_NAMES,
  'weaken.js',
  'work.js',
]);
const WORK_SCRIPT: Script = 'work.js';

// --- SCRIPT STATE ---
type State = {
  nextServerIndex: number;
  currentTargets: number;
};

const defaultState: State = {
  nextServerIndex: 0,
  currentTargets: 0,
};

// --- RUNTIME VARIABLES ---
type Tools = 'weaken' | 'grow' | 'hack';
type Tool = {
  readonly name: string;
  readonly short: Tools;
  readonly cost: number;
  readonly allowThreadSpreading: boolean;
};

// tools
let tools: Map<Tools, Tool> = new Map();

// multipliers for player abilities
let playerHackingMoneyMult: number;
let playerHackingGrowMult: number;

// bitnode multipliers that can be automatically set by SF-5
let bitnodeMults: number = 1;
let bitnodeHackingMoneyMult: number = 1;
let bitnodeGrowMult: number = 1;
let bitnodeWeakenMult: number = 1;

// --- FUNCTIONS ---

const actualWeakenPotency = () => bitnodeWeakenMult * WEAKEN_THREAD_POTENCY;

const getTool = (tool: Tools): Tool => tools.get(tool)!;

const getMaxThreads = (tool: Tool, workers: ReadonlyArray<Server>) => {
  const workerServers = orderBy(workers, getFreeServerRam, false);
  let maxThreads = 0;
  for (const worker of workerServers) {
    const threadsHere = Math.floor(getFreeServerRam(worker) / tool.cost);
    if (!tool.allowThreadSpreading) return threadsHere;

    if (threadsHere <= 0) break;

    maxThreads += threadsHere;
  }

  return maxThreads;
};

type ServerInfo = {
  readonly maxMoney: number;
  readonly growthRate: number;
  readonly minSec: number;
  readonly baseSec: number;
  readonly weakenTime: number;
  readonly rank: number;
  readonly currentRank: number;
  readonly server: Server;
};

const getInfo = (server: Server): ServerInfo | null => {
  if (!hasRootAccess(server)) return null;
  const maxMoney = getMaxMoney(server);
  const growthRate = getGrowth(server);
  const minSec = getMinSecurityLevel(server);
  const baseSec = getBaseSecurityLevel(server);
  const weakenTime = getWeakenTime(server);
  const currentSec = getSecurityLevel(server);

  const rank = (maxMoney * growthRate) / (weakenTime * baseSec);
  const currentRank =
    currentSec < minSec * 1.1 ? rank * (minSec * 1.1 - currentSec + 1) : rank;

  return {
    maxMoney,
    growthRate,
    minSec,
    baseSec,
    weakenTime,
    rank,
    currentRank,
    server,
  };
};

const deleteSingleServer = (
  ns: NS,
  servers: ReadonlyArray<string>,
  logger: Logger,
) => {
  let minRam = Number.MAX_SAFE_INTEGER;
  let minServer: string | null = null;
  for (const server of servers) {
    const [ram] = ns.getServerRam(server);
    if (ram < minRam) {
      minRam = ram;
      minServer = server;
    }
  }

  if (minServer !== null) {
    logger`Deleting server ${minServer}`;
    ns.deleteServer(minServer);
  }
};

const getPurchasedServersMinRamExponent = (
  ns: NS,
  servers: ReadonlyArray<string>,
) => {
  if (servers.length === 0) {
    return MIN_RAM_EXPONENT;
  }

  const limit = ns.getPurchasedServerLimit();
  let minRamExp = MAX_RAM_EXPONENT;
  for (const server of servers) {
    const [ram] = ns.getServerRam(server);
    const expo = Math.log2(ram);
    if (expo < minRamExp) minRamExp = expo;
  }

  if (servers.length === limit) {
    minRamExp += 1;
  }

  return minRamExp >= MAX_RAM_EXPONENT ? null : minRamExp;
};

const maybeBuyServer = (
  ns: NS,
  investor: Investor,
  logger: Logger,
  state: State,
) => {
  const servers = ns.getPurchasedServers();
  const budget = getBudget(investor);
  const minRamExponent = getPurchasedServersMinRamExponent(ns, servers);
  const limit = ns.getPurchasedServerLimit();

  // done, all servers max upgraded, nothing more to do
  if (minRamExponent === null) return false;

  let ramExponent = minRamExponent;
  while (
    ns.getPurchasedServerCost(Math.pow(2, ramExponent)) < budget.moneyLeft &&
    ramExponent < MAX_RAM_EXPONENT
  ) {
    ramExponent += 1;
  }

  if (ns.getPurchasedServerCost(Math.pow(2, ramExponent)) > budget.moneyLeft) {
    // We can't afford any new servers
    if (ramExponent > minRamExponent) return false;

    ramExponent -= 1;
  }

  const cost = ns.getPurchasedServerCost(Math.pow(2, ramExponent));
  return tryInvest(investor, 'host', cost, ns => {
    if (servers.length >= limit) deleteSingleServer(ns, servers, logger);
    const newServer = ns.purchaseServer(
      `farm-${state.nextServerIndex++}`,
      Math.pow(2, ramExponent),
    );
    if (!newServer || newServer.trim().length === 0) return 0;
    logger`Purchased new server ${newServer} with 2^${ramExponent} (${Math.pow(
      2,
      ramExponent,
    )}GB) ram`;
    ns.scp(SCRIPT_FILES, 'home', newServer);
    return cost;
  });
};

const ensureHasFiles = (
  ns: NS,
  server: Server,
  files: ReadonlyArray<string>,
) => {
  for (const file of files) {
    if (!fileExists(server, file)) {
      ns.scp(file, 'home', getHostname(server));
    }
  }
};

const maybeHackServer = (ns: NS, logger: Logger) => {
  let newlyHacked = false;
  const network = scanNetwork(ns);
  for (const node of flattenNetwork(network)) {
    const hacked = hasRootAccess(node.server);
    if (!hacked && getHackStatus(node.server) === HackStatus.Hacked) {
      newlyHacked = true;
      ns.scp(SCRIPT_FILES, 'home', getHostname(node.server));
      logger`Hacked server ${getHostname(node.server)}`;
    }

    ensureHasFiles(ns, node.server, SCRIPT_FILES);
  }

  return newlyHacked;
};

const getAllServers = (ns: NS) => {
  const network = scanNetwork(ns);
  return [
    ...flattenNetwork(network)
      .map(node => node.server)
      .filter(hasRootAccess)
      .filter(s => getHostname(s) !== 'home'),
  ];
};

const getWorkerServers = (ns: NS) =>
  getAllServers(ns).filter(server => getServerRam(server).total > 2);
const getTargetServers = (ns: NS) => {
  const purchasedServers = new Set(ns.getPurchasedServers());
  return getAllServers(ns)
    .filter(s => getMaxMoney(s) > 0)
    .filter(s => !purchasedServers.has(getHostname(s)));
};

const isTargeting = (server: Server, workers: ReadonlyArray<Server>) => {
  for (const worker of workers) {
    for (const process of runningProcesses(worker)) {
      if (
        TOOL_NAMES.includes(process.filename) &&
        process.args[0] === getHostname(server)
      ) {
        if (process.args.length > 4 && process.args[4] !== 'prep') {
          return true;
        }
      }
    }
  }

  return false;
};

const isPrepping = (server: Server, workers: ReadonlyArray<Server>) => {
  for (const worker of workers) {
    for (const process of runningProcesses(worker)) {
      if (
        TOOL_NAMES.includes(process.filename) &&
        process.args[0] === getHostname(server)
      ) {
        if (process.args.length > 4 && process.args[4] === 'prep') {
          return true;
        }
      }
    }
  }

  return false;
};

const adjustedGrowthRate = (target: ServerInfo) =>
  Math.min(MAX_GROWTH_RATE, 1 + (UNAJUSTED_GROWTH_RATE - 1) / target.minSec);
const serverGrowthPercentage = (target: ServerInfo) =>
  (target.growthRate * bitnodeGrowMult * playerHackingGrowMult) / 100;
const targetGrowthCoefficient = (target: ServerInfo) =>
  target.maxMoney / Math.max(getAvailableMoney(target.server), 1);
const cyclesNeededForGrowthCoefficient = (target: ServerInfo) =>
  Math.log(targetGrowthCoefficient(target)) /
  Math.log(adjustedGrowthRate(target));
const getGrowThreadsNeeded = (target: ServerInfo) =>
  Math.ceil(
    cyclesNeededForGrowthCoefficient(target) / serverGrowthPercentage(target),
  );
const getWeakenThreadsNeeded = (target: ServerInfo) =>
  Math.ceil(
    (getSecurityLevel(target.server) - target.minSec) / actualWeakenPotency(),
  );

const arbitraryExecution = async (
  ns: NS,
  tool: Tool,
  threads: number,
  workers: ReadonlyArray<Server>,
  args: ReadonlyArray<string | number>,
) => {
  const workerServers = orderBy(workers, getFreeServerRam, false);
  let totalThreads = 0;
  for (const server of workerServers) {
    // we've done it, move on.
    if (threads <= 0) break;

    const maxThreadsHere = Math.min(
      threads,
      Math.floor(getFreeServerRam(server) / tool.cost),
    );
    if (maxThreadsHere <= 0) continue;

    threads -= maxThreadsHere;
    totalThreads += maxThreadsHere;

    ensureHasFiles(ns, server, [tool.name]);
    await ns.exec(
      tool.name,
      getHostname(server),
      maxThreadsHere,
      ...args.map(String),
    );

    if (!tool.allowThreadSpreading) return true;
  }

  return totalThreads > 0;
};

const prepServer = async (
  ns: NS,
  target: ServerInfo,
  workerServers: ReadonlyArray<Server>,
  logger: Logger,
) => {
  // once we're in scheduling mode, presume prep server is to be skipped.
  if (isTargeting(target.server, workerServers)) return;

  const now = Date.now();
  if (
    getSecurityLevel(target.server) > target.minSec ||
    getAvailableMoney(target.server) < target.maxMoney
  ) {
    const weakenTool = getTool('weaken');
    let weakenForGrowthThreadsNeeded = 0;
    if (getAvailableMoney(target.server) < target.maxMoney) {
      const growTool = getTool('grow');
      const growThreadsAllowable = getMaxThreads(growTool, workerServers);
      const growThreadsNeeded = getGrowThreadsNeeded(target);
      let trueGrowThreadsNeeded = Math.min(
        growThreadsAllowable,
        growThreadsNeeded,
      );
      weakenForGrowthThreadsNeeded = Math.ceil(
        (trueGrowThreadsNeeded * GROWTH_THREAD_HARDENING) /
          actualWeakenPotency(),
      );
      const growThreadThreshold =
        (growThreadsAllowable - growThreadsNeeded) *
        (growTool.cost / weakenTool.cost);
      let growThreadsReleased =
        (weakenTool.cost / growTool.cost) *
        (weakenForGrowthThreadsNeeded + getWeakenThreadsNeeded(target));
      if (growThreadThreshold >= growThreadsReleased) {
        growThreadsReleased = 0;
      }

      trueGrowThreadsNeeded -= growThreadsReleased;
      if (trueGrowThreadsNeeded > 0) {
        logger`Prepping ${target.server} [grow].`;
        await arbitraryExecution(
          ns,
          growTool,
          trueGrowThreadsNeeded,
          workerServers,
          [getHostname(target.server), now, now, 0, 'prep'],
        );
      }
    }

    const threadsNeeded =
      getWeakenThreadsNeeded(target) + weakenForGrowthThreadsNeeded;
    const threadSleep = getWeakenTime(target.server) * 1000 * QUEUE_DELAY;
    const threadsAllowable = getMaxThreads(weakenTool, workerServers);
    const trueThreads = Math.min(threadsAllowable, threadsNeeded);
    if (trueThreads > 0) {
      logger`Prepping ${target.server} [weaken], resting for ${Math.floor(
        threadSleep / 1000,
      )} seconds.`;
      await arbitraryExecution(ns, weakenTool, trueThreads, workerServers, [
        getHostname(target.server),
        now,
        now,
        0,
        'prep',
      ]);
    }
  }
};

const retargetServers = async (ns: NS, logger: Logger, state: State) => {
  const workerServers = orderBy(getWorkerServers(ns), getFreeServerRam, false);
  const targetServers = orderBy(
    getTargetServers(ns)
      .map(getInfo)
      .filter(Boolean) as Array<ServerInfo>,
    'currentRank',
  );

  if (state.currentTargets < MAX_TARGETS) {
    for (const target of targetServers) {
      if (state.currentTargets >= MAX_TARGETS) break;

      // now don't do anything to it until prep finishes, because it is in a resting state.
      if (isPrepping(target.server, workerServers)) continue;

      // if the target is in a resting state (we have scripts running against it), proceed to the next target.
      if (isTargeting(target.server, workerServers)) continue;

      // increment the target counter, consider this an optimal target
      state.currentTargets++;

      // perform weakening and initial growth until the server is "perfected"
      await prepServer(ns, target, workerServers, logger);

      // now don't do anything to it until prep finishes, because it is in a resting state.
      if (isPrepping(target.server, workerServers)) continue;

      // the server isn't optimized, this means we're out of ram from a more optimal target
      if (
        getSecurityLevel(target.server) > target.minSec ||
        getAvailableMoney(target.server) < target.maxMoney
      )
        continue;

      // adjust the percentage to steal until it's able to rapid fire as many as it can
      //await optimizePerformanceMetrics(ns, target, workerServers);

      // once conditions are optimal, fire barrage after barrage of cycles in a schedule
      //await performScheduling(ns, target, workerServers);
    }
  }
};

const registerTool = (
  ns: NS,
  short: Tools,
  name: string,
  allowDistributed: boolean = false,
): void => {
  const tool: Tool = Object.freeze({
    name,
    short,
    cost: ns.getScriptRam(name, 'home'),
    allowThreadSpreading: allowDistributed,
  });

  tools.set(short, tool);
};

export const main = async (ns: NS) => {
  ns.disableLog('ALL');
  const state = mkState<State>(ns, defaultState);
  const term = createTerminalLogger(ns);
  const logger = createLogger(ns);

  registerTool(ns, 'weaken', WEAKEN_TOOL_NAME, true);
  registerTool(ns, 'grow', GROW_TOOL_NAME);
  registerTool(ns, 'hack', HACK_TOOL_NAME);

  const mults = ns.getHackingMultipliers();
  playerHackingGrowMult = mults.growth;
  playerHackingMoneyMult = mults.money;

  const investor = new Investor(ns, 'servers', 400);
  await retargetServers(ns, logger, state);
  while (true) {
    // First, try to acquire new servers, if we can afford it
    let newFarmServer = maybeBuyServer(ns, investor, term, state);

    // Then, try to hack any servers we are now high enough level for (or has the tools for)
    let newHackedServer = maybeHackServer(ns, term);

    if (newFarmServer || newHackedServer) {
      await retargetServers(ns, logger, state);
    }

    await ns.sleep(10_000);
  }
};
