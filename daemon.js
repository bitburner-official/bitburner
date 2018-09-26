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

const _update = Symbol('state:update');
const _reset = Symbol('state:reset');
const state = (ns, defaultState, owner = ns.getScriptName()) => {
    const name = owner + '.state.json.txt';
    const writeState = (state) => {
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
        let data;
        try {
            data = JSON.parse(json);
        }
        catch (_a) {
            writeState(defaultState);
            data = JSON.parse(JSON.stringify(defaultState));
        }
        return data;
    };
    const updateState = (fn) => {
        const state = readState();
        const ret = fn(state);
        writeState(state);
        return ret;
    };
    const resetState = () => {
        writeState(defaultState);
    };
    const mkProxy = (basePath, base) => new Proxy(base, {
        get(_, property) {
            if (property === _update) {
                return updateState;
            }
            if (property === _reset) {
                return resetState;
            }
            const path = [...basePath, property];
            let data = readState();
            for (const part of path) {
                if (data && data.hasOwnProperty(part)) {
                    data = data[part];
                }
                else {
                    data = void 0;
                }
            }
            if (data === null ||
                typeof data === 'undefined' ||
                typeof data === 'number' ||
                typeof data === 'string' ||
                typeof data === 'boolean')
                return data;
            return mkProxy(path, Array.isArray(data) ? [] : {});
        },
        set(_, property, value) {
            if (typeof property === 'symbol') {
                return false;
            }
            const path = [...basePath];
            let data = readState();
            for (const part of path) {
                if (data.hasOwnProperty(part)) {
                    data = data[part];
                }
                else {
                    throw new Error(`Object has no property '${part}' (part of '${path.join('.')}')`);
                }
            }
            if (data && typeof data === 'object') {
                data[property] = value;
                return true;
            }
            return false;
        },
    });
    return mkProxy([], {});
};
const reset = (updatable) => updatable[_reset]();

const LEDGER_STATE_OWNER = 'ledger';
const getState = (ns) => state(ns, {}, LEDGER_STATE_OWNER);
const resetInvestments = (ns) => reset(getState(ns));

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

export { main };
