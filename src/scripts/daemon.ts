import { Host, BitBurner as NS, Script, StockSymbol } from 'bitburner';
import { Server, fileExists, getHostname, getServerRam } from '../core/server';
import { createLogger, createTerminalLogger } from '../utils/print';

interface Manifest {
  readonly scripts: ReadonlyArray<string>;
  readonly hash: string;
}

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

const download = async (path: string): Promise<string> => {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}`);
  }

  return await response.text();
};

const downloadFiles = async (ns: NS, manifest: Manifest) => {
  const files = await Promise.all(
    manifest.scripts.map(async name => ({
      name,
      content: await download(
        `https://raw.githubusercontent.com/Alxandr/bitburner/dist/${name}`,
      ),
    })),
  );

  for (const { name, content } of files) {
    ns.write(name, content);
  }
};

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

  const term = createTerminalLogger(ns);
  const server = new Server(ns, daemonHost);
  const latestManifestStr = await download(
    `https://alxandr.github.io/bitburner/manifest.json`,
  );
  const latestManifest: Manifest = JSON.parse(latestManifestStr);
  let anyMissing = false;
  for (const script of latestManifest.scripts) {
    if (!fileExists(server, script)) {
      term`Script missing: ${script}`;
      term`export { main } from 'https://alxandr.github.io/bitburner/${script}';`;
      anyMissing = true;
    }
  }

  if (anyMissing) return;

  if (await ns.prompt(`Enable hacknet manager?`)) {
    // buy a single hacknet node (required for hacknet script to work).
    if (ns.hacknet.numNodes() === 0) {
      ns.hacknet.purchaseNode();
    }

    // start hacknet script
    await ns.exec('hacknet.js', 'home');
  }

  if (await ns.prompt(`Enable stock broker`)) {
    // start stock-broker
    await ns.exec('stock-broker.js', 'home', 1, ...stocks);
  }

  // start weakening for level
  await startWeakenScript(ns, server);
};
