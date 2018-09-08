const _hostname = Symbol('server:hostname');
const _ns = Symbol('ns');
var HackStatus;
(function (HackStatus) {
    HackStatus[HackStatus["Hacked"] = 0] = "Hacked";
    HackStatus[HackStatus["NeedsLevel"] = 1] = "NeedsLevel";
    HackStatus[HackStatus["NeedsPorts"] = 2] = "NeedsPorts";
})(HackStatus || (HackStatus = {}));
class Server {
    constructor(ns, hostname) {
        this[_hostname] = hostname;
        this[_ns] = ns;
        Object.freeze(this);
    }
}
const getHostname = (server) => server[_hostname];
const getServerRam = (server) => {
    const [total, used] = server[_ns].getServerRam(server[_hostname]);
    return { total, used };
};

const arg = (v) => {
    if (typeof v === 'undefined')
        return '<undefined>';
    if (v === null)
        return '<null>';
    if (typeof v.toLocaleString === 'function')
        return v.toLocaleString();
    return String(v);
};
const prettifyString = (literals, ...placeholders) => {
    let result = '';
    for (let i = 0; i < placeholders.length; i++) {
        result += literals[i];
        result += arg(placeholders[i]);
    }
    // add the last literal
    result += literals[literals.length - 1];
    return result;
};
const maybeStr = (prefix) => typeof prefix === 'string' ? prefix : '';
const createLogger = (ns, prefix) => (literals, ...placeholders) => ns.print(maybeStr(prefix) + prettifyString(literals, ...placeholders));

const LEDGER_FILE = 'ledger.json';
const resetInvestments = (ns) => ns.rm(LEDGER_FILE);

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
        await ns.exec('server-farm.js', 'home');
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

export { main };
