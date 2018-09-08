import {
  HackStatus,
  getHackStatus,
  getHostname,
  getServerRam,
  hasRootAccess,
} from '../core/server';
import { Host, BitBurner as NS, Script } from 'bitburner';
import { Investor, getBudget, tryInvest } from '../utils/investor';
import { flattenNetwork, scanNetwork } from '../utils/network';

const MIN_RAM_EXPONENT = 4;
const MAX_RAM_EXPONENT = 20;
const SCRIPT_FILES: ReadonlyArray<string> = ['weaken.js', 'work.js'];
const WORK_SCRIPT: Script = 'work.js';

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

const maybeBuyServer = (ns: NS, investor: Investor) => {
  const servers = ns.getPurchasedServers();
  const budget = getBudget(investor);
  const minRamExponent = getPurchasedServersMinRamExponent(ns, servers);

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
    if (ramExponent <= minRamExponent) return false;

    ramExponent -= 1;
  }

  const cost = ns.getPurchasedServerCost(Math.pow(2, ramExponent));
  return tryInvest(investor, 'host', cost, ns => {
    const newServer = ns.purchaseServer('farm', Math.pow(2, ramExponent));
    if (!newServer || newServer.trim().length === 0) return 0;
    ns.scp(SCRIPT_FILES, 'home', newServer);
    return cost;
  });
};

const maybeHackServer = (ns: NS) => {
  let newlyHacked = false;
  const network = scanNetwork(ns);
  for (const node of flattenNetwork(network)) {
    const hacked = hasRootAccess(node.server);
    if (!hacked && getHackStatus(node.server) === HackStatus.Hacked) {
      newlyHacked = true;
      ns.scp(SCRIPT_FILES, 'home', getHostname(node.server));
    }
  }

  return newlyHacked;
};

const getAllServers = (ns: NS) => {
  const network = scanNetwork(ns);
  return [
    ...ns.getPurchasedServers(),
    ...flattenNetwork(network)
      .filter(node => getServerRam(node.server).total > 2)
      .map(node => getHostname(node.server)),
  ];
};

const retargetServers = async (ns: NS, host: Host) => {
  const maxMoney = ns.getServerMaxMoney(host);
  const minSec = ns.getServerMinSecurityLevel(host);
  //const baseSec = ns.getServerBaseSecurityLevel(host);
  const minMoney = maxMoney * 0.9;
  const maxSec = minSec + 10;
  const servers = getAllServers(ns);
  const ramUsage = ns.getScriptRam(WORK_SCRIPT, 'home');

  for (const server of servers) {
    if (ns.scriptRunning(WORK_SCRIPT, server)) {
      const processInfo = ns
        .ps(server)
        .find(info => info.filename === WORK_SCRIPT)!;
      if (processInfo.args[0] === host) {
        continue;
      }
    }

    const [_, ram] = ns.getServerRam(server);
    const threads = Math.floor(ram / ramUsage);
    await ns.exec(
      WORK_SCRIPT,
      server,
      threads,
      host,
      String(maxSec),
      String(minMoney),
    );
  }
};

export const main = async (ns: NS) => {
  ns.disableLog('getServerMoneyAvailable');
  ns.disableLog('sleep');

  const investor = new Investor(ns, 'servers', 40);
  while (true) {
    // First, try to acquire new servers, if we can afford it
    let newFarmServer = maybeBuyServer(ns, investor);

    // Then, try to hack any servers we are now high enough level for (or has the tools for)
    let newHackedServer = maybeHackServer(ns);

    if (newFarmServer || newHackedServer) {
      await retargetServers(ns, 'foodnstuff');
    }

    await ns.sleep(10_000);
  }
};
