import { Host, BitBurner as NS, Script, StockSymbol } from 'bitburner';
import { Server, getHostname, getServerRam } from '../core/server';

import { createLogger } from '../utils/print';
import { resetInvestments } from '../utils/investor';

// --- CONSTANTS ---

// server and script to run weaken on ad absurdum
const weakenScript: Script = 'weaken.js';
const weakenServer: Host = 'foodnstuff';

// Stocks to run algorithm on
const stocks: ReadonlyArray<StockSymbol> = Object.freeze([
  'ECP',
  'BLD',
  'OMTK',
  'FSIG',
  'FLCM',
  'CTYS',
] as Array<StockSymbol>);

// --- FUNCTIONS ---

// start the weakening script for levels
const startWeakenScript = async (ns: NS, server: Server) => {
  const log = createLogger(ns);
  const cost = ns.getScriptRam(weakenScript, getHostname(server));
  const { total, used } = getServerRam(server);
  const maxThreads = Math.floor((total - used) / cost);
  log`Max number of threads to use for weaken: ${maxThreads}`;

  let runThreads;
  if (maxThreads > 1000) {
    runThreads = maxThreads - 100;
  } else if (maxThreads > 100) {
    runThreads = maxThreads - 10;
  } else if (maxThreads > 10) {
    runThreads = maxThreads;
  } else {
    log`Not starting weaken script, due to too little ram`;
    return;
  }

  await ns.nuke(weakenServer);
  await ns.exec(weakenScript, getHostname(server), runThreads, weakenServer);
};

export const main = async (ns: NS) => {
  // get the name of this node
  const daemonHost = ns.getHostname();

  if (daemonHost !== 'home') {
    throw new Error(`Daemon is only intended to run on 'home' host.`);
  }

  const server = new Server(ns, daemonHost);

  if (await ns.prompt(`Remove old investment ledger?`)) {
    resetInvestments(ns);
  }

  if (await ns.prompt(`Enable hacknet manager?`)) {
    // buy a single hacknet node (required for hacknet script to work).
    if (ns.hacknet.numNodes() === 0) {
      ns.hacknet.purchaseNode();
    }

    // start hacknet script
    await ns.exec('hacknet.js', 'home');
  }

  if (await ns.prompt(`Enable server farm?`)) {
    await ns.exec('server-farm.js', 'home', 1, String(Date.now()));
  }

  if (await ns.prompt(`Enable stock broker`)) {
    // start stock-broker
    await ns.exec('stock-broker.js', 'home', 1, ...stocks);
  }

  if (await ns.prompt('Start weakening foodnstuff for exp?')) {
    // start weakening for level
    await startWeakenScript(ns, server);
  }
};
