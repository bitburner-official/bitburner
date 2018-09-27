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
import { Investor, getBudget, tryInvest } from '../utils/investor';
import { Logger, createLogger, createTerminalLogger } from '../utils/print';
import { BitBurner as NS, ProcessInfo, Script } from 'bitburner';
import { Tool, maxThreads, runTool, toolCost } from '../core/tool';
import { findLast, orderBy, without } from '../utils/array';
import { flattenNetwork, scanNetwork } from '../utils/network';
import mkState, { Updatable, reset, update } from '../utils/state';

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
const ARBITRARY_EXECUTION_DELAY = 12_000;

// the delay that it can take for a script to start, used to pessimistically schedule things in advance
const QUEUE_DELAY = 12000;

// the max number of batches this daemon will spool up to avoid running out of IRL ram
const MIN_WORKER_RAM = 16;

// minimum and maximum ram exponents to purchase servers with.
const MIN_RAM_EXPONENT = 4; // 16GB
const MAX_RAM_EXPONENT = 20; // 2^20 GB

// server used to level instead of money
const LEVEL_TARGET = 'foodnstuff';

// scripts to copy to all managed servers
const WEAKEN_TOOL_NAME = 'weaken-target.js';
const GROW_TOOL_NAME = 'grow-target.js';
const HACK_TOOL_NAME = 'hack-target.js';

// added arg to all started tools to keep track of origin
const ORIGIN_ARG = '--origin=server-farm';
const LEVEL_ARG = '--purpose=gain-exp';

// --- SCRIPT STATE ---
type State = {
  minRamExponent: number;
  nextServerIndex: number;
  currentTargets: number;
};

const defaultState: State = {
  minRamExponent: MIN_RAM_EXPONENT,
  nextServerIndex: 0,
  currentTargets: 0,
};

// --- RUNTIME VARIABLES ---
// tools
let weakenTool: Tool;
let growTool: Tool;
let hackTool: Tool;

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
  const currentRank = currentSec <= minSec ? rank * (100 - minSec) : rank;

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

const maybeBuyServer = (
  ns: NS,
  investor: Investor,
  logger: Logger,
  state: Updatable<State>,
) => {
  const servers = ns.getPurchasedServers();
  const budget = getBudget(investor);
  const limit = ns.getPurchasedServerLimit();

  return update(state, state => {
    // done, all servers max upgraded, nothing more to do
    if (state.minRamExponent > MAX_RAM_EXPONENT) return false;

    // check if we can afford a new server
    if (
      ns.getPurchasedServerCost(Math.pow(2, state.minRamExponent)) >=
      budget.moneyLeft
    ) {
      return false;
    }

    // see if we can go for more expensive servers
    let ramExponent = state.minRamExponent;
    while (
      ramExponent < MAX_RAM_EXPONENT - 1 &&
      ns.getPurchasedServerCost(Math.pow(2, ramExponent + 1)) < budget.moneyLeft
    ) {
      ramExponent += 1;
    }

    const cost = ns.getPurchasedServerCost(Math.pow(2, ramExponent));
    return tryInvest(investor, 'host', cost, ns => {
      if (servers.length >= limit) deleteSingleServer(ns, servers, logger);
      const newServer = ns.purchaseServer(
        `farm-${state.nextServerIndex++}`,
        Math.pow(2, ramExponent),
      );
      if (!newServer || newServer.trim().length === 0) {
        state.nextServerIndex--;
        return 0;
      }
      state.minRamExponent = ramExponent;
      logger`Purchased new server ${newServer} with 2^${ramExponent} (${Math.pow(
        2,
        ramExponent,
      )}GB) ram`;
      return cost;
    });
  });
};

const maybeHackServer = (ns: NS, logger: Logger) => {
  let newlyHacked = false;
  const network = scanNetwork(ns);
  for (const node of flattenNetwork(network)) {
    const hacked = hasRootAccess(node.server);
    if (!hacked && getHackStatus(node.server) === HackStatus.Hacked) {
      newlyHacked = true;
      logger`Hacked server ${getHostname(node.server)}`;
    }
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
    .filter(s => !purchasedServers.has(getHostname(s)))
    .filter(s => getHostname(s) !== LEVEL_TARGET); // used for levling
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

const weaken = async (
  target: ServerInfo,
  workers: ReadonlyArray<Server>,
  logger: Logger,
): Promise<ReadonlyArray<Server>> => {
  const neededThreads = getWeakenThreadsNeeded(target);
  const minServer = findLast(
    workers,
    server => maxThreads(weakenTool, server) >= neededThreads,
  );
  const threads = Math.min(maxThreads(weakenTool, minServer), neededThreads);
  logger`Weaken ${
    target.server
  } with ${threads} threads (wanted ${neededThreads})`;
  await runTool(weakenTool, minServer, threads, [
    getHostname(target.server),
    ORIGIN_ARG,
  ]);

  const freeRam = getFreeServerRam(minServer);
  if (freeRam > MIN_WORKER_RAM) {
    return orderBy(workers, getFreeServerRam, false);
  }

  return without(workers, minServer);
};

const grow = async (
  target: ServerInfo,
  workers: ReadonlyArray<Server>,
  logger: Logger,
): Promise<ReadonlyArray<Server>> => {
  const neededThreads = getGrowThreadsNeeded(target);
  const minServer = findLast(
    workers,
    server => maxThreads(growTool, server) >= neededThreads,
  );
  const threads = Math.min(maxThreads(growTool, minServer), neededThreads);
  logger`Grow ${
    target.server
  } with ${threads} threads (wanted ${neededThreads})`;
  await runTool(growTool, minServer, threads, [
    getHostname(target.server),
    ORIGIN_ARG,
  ]);

  const freeRam = getFreeServerRam(minServer);
  if (freeRam > MIN_WORKER_RAM) {
    return orderBy(workers, getFreeServerRam, false);
  }

  return without(workers, minServer);
};

const hack = async (
  target: ServerInfo,
  workers: ReadonlyArray<Server>,
  logger: Logger,
): Promise<ReadonlyArray<Server>> => {
  // TODO: Calculate best hacking thread count
  const [worker, ...rest] = workers;
  const threads = maxThreads(hackTool, worker);
  logger`Hack ${target.server} with ${threads} threads`;
  await runTool(hackTool, worker, threads, [
    getHostname(target.server),
    ORIGIN_ARG,
  ]);
  return rest;
};

const scheduleServers = async (
  ns: NS,
  logger: Logger,
  state: State,
  workers: ReadonlyArray<Server>,
  targets: ReadonlyArray<ServerInfo>,
): Promise<void> => {
  if (workers.length === 0) return;

  if (targets.length === 0) {
    // use the rest of the servers for level gaining
    for (const worker of workers) {
      const threads = maxThreads(weakenTool, worker);
      await runTool(weakenTool, worker, threads, [
        LEVEL_TARGET,
        ORIGIN_ARG,
        LEVEL_ARG,
      ]);
    }
  }

  const [target, ...restTargets] = targets;
  const sec = getSecurityLevel(target.server);
  if (sec > target.minSec) {
    const restWorkers = await weaken(target, workers, logger);
    return await scheduleServers(ns, logger, state, restWorkers, restTargets);
  }

  const money = getAvailableMoney(target.server);
  if (money < target.maxMoney) {
    const restWorkers = await grow(target, workers, logger);
    return await scheduleServers(ns, logger, state, restWorkers, restTargets);
  }

  const restWorkers = await hack(target, workers, logger);
  return await scheduleServers(ns, logger, state, restWorkers, restTargets);
};

const startWork = async (ns: NS, logger: Logger, state: State) => {
  const workerServers = orderBy(
    getWorkerServers(ns),
    getFreeServerRam,
    false,
  ).filter(s => getFreeServerRam(s) > MIN_WORKER_RAM);

  const existingTargets = new Set(
    getWorkerServers(ns)
      .reduce(
        (procs, s) => [...procs, ...runningProcesses(s)],
        [] as ReadonlyArray<ProcessInfo>,
      )
      .filter(p => p.args.includes(ORIGIN_ARG, 1))
      .map(p => p.args[0]),
  );

  const untargeted = (s: Server) => !existingTargets.has(getHostname(s));
  const targetServers = orderBy(
    getTargetServers(ns)
      .filter(untargeted)
      .map(getInfo)
      .filter(Boolean) as ReadonlyArray<ServerInfo>,
    'currentRank',
  );

  await scheduleServers(ns, logger, state, workerServers, targetServers);
};

export const main = async (ns: NS) => {
  ns.disableLog('ALL');
  const state = mkState<State>(ns, defaultState);
  const term = createTerminalLogger(ns);
  const logger = createLogger(ns);
  const [startTimeStr] = ns.args;
  const startTime = parseInt(startTimeStr, 10);
  if (Date.now() - startTime < 60 * 1000 /* 60 seconds */) {
    reset(state);
  }

  weakenTool = new Tool(ns, WEAKEN_TOOL_NAME);
  growTool = new Tool(ns, GROW_TOOL_NAME);
  hackTool = new Tool(ns, HACK_TOOL_NAME);

  const mults = ns.getHackingMultipliers();
  playerHackingGrowMult = mults.growth;
  playerHackingMoneyMult = mults.money;

  const investor = new Investor(ns, 'servers', 40);
  while (true) {
    // First, try to acquire new servers, if we can afford it
    maybeBuyServer(ns, investor, term, state);

    // Then, try to hack any servers we are now high enough level for (or has the tools for)
    maybeHackServer(ns, term);

    await startWork(ns, logger, state);

    await ns.sleep(30_000);
  }
};
