import { a as Server, b as getHostname, c as getServerRam } from './chunk.4117d657.js';
import { g as createLogger, h as createTerminalLogger } from './chunk.06fc0bd6.js';

// --- CONSTANTS ---
// server and script to run weaken on ad absurdum
const weakenScript = 'weaken.js';
const weakenServer = 'foodnstuff';
// Stocks to run algorithm on
const stocks = Object.freeze([
    'ECP',
    'BLD',
    'OMTK',
    'FSIG',
    'FLCM',
    'CTYS',
]);
// --- FUNCTIONS ---
const download = async (path) => {
    const response = await fetch(path);
    if (!response.ok) {
        throw new Error(`Failed to fetch ${path}`);
    }
    return await response.text();
};
const downloadFiles = async (ns, manifest) => {
    const files = await Promise.all(manifest.scripts.map(async (name) => ({
        name,
        content: await download(`https://raw.githubusercontent.com/Alxandr/bitburner/dist/${name}`),
    })));
    for (const { name, content } of files) {
        ns.write(name, content);
    }
};
// start the weakening script for levels
const startWeakenScript = async (ns, server) => {
    const log = createLogger(ns);
    const cost = ns.getScriptRam(weakenScript, getHostname(server));
    const { total, used } = getServerRam(server);
    const maxThreads = Math.floor((total - used) / cost);
    log `Max number of threads to use for weaken: ${maxThreads}`;
    let runThreads;
    if (maxThreads > 1000) {
        runThreads = maxThreads - 100;
    }
    else if (maxThreads > 100) {
        runThreads = maxThreads - 10;
    }
    else if (maxThreads > 10) {
        runThreads = maxThreads;
    }
    else {
        log `Not starting weaken script, due to too little ram`;
        return;
    }
    await ns.nuke(weakenServer);
    await ns.exec(weakenScript, getHostname(server), runThreads, weakenServer);
};
const main = async (ns) => {
    // get the name of this node
    const daemonHost = ns.getHostname();
    if (daemonHost !== 'home') {
        throw new Error(`Daemon is only intended to run on 'home' host.`);
    }
    const term = createTerminalLogger(ns);
    const server = new Server(ns, daemonHost);
    const manifestExists = ns.fileExists('manifest.json');
    let hash = null;
    if (manifestExists) {
        const manifestStr = ns.read('manifest.json');
        if (manifestStr.length > 0) {
            const manifest = JSON.parse(manifestStr);
            hash = manifest.hash;
        }
    }
    else {
        term `No manifest found`;
    }
    const latestManifestStr = await download(`https://raw.githubusercontent.com/Alxandr/bitburner/dist/manifest.json`);
    const latestManifest = JSON.parse(latestManifestStr);
    if (latestManifest.hash !== hash) {
        term `New version of scripts available, downloading`;
        await downloadFiles(ns, latestManifest);
        term `New version of scripts downloaded. Restarting daemon.`;
        await ns.spawn('daemon.js');
        return;
    }
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

export { main };
