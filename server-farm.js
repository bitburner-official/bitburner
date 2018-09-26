const getPlayerMoney = (ns) => ns.getServerMoneyAvailable('home');
const getPlayerHackingLevel = (ns) => ns.getHackingLevel();
const hasBrutessh = (ns) => ns.fileExists('brutessh.exe', 'home');
const hasFtpcrack = (ns) => ns.fileExists('ftpcrack.exe', 'home');
const hasRelaysmtp = (ns) => ns.fileExists('relaysmtp.exe', 'home');
const hasHttpworm = (ns) => ns.fileExists('httpworm.exe', 'home');
const hasSqlinject = (ns) => ns.fileExists('sqlinject.exe', 'home');

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
const getFreeServerRam = (server) => {
    const [total, used] = server[_ns].getServerRam(server[_hostname]);
    return total - used;
};
const hasRootAccess = (server) => server[_ns].hasRootAccess(server[_hostname]);
const getAvailableMoney = (server) => server[_ns].getServerMoneyAvailable(server[_hostname]);
const getMaxMoney = (server) => server[_ns].getServerMaxMoney(server[_hostname]);
const getGrowth = (server) => server[_ns].getServerGrowth(server[_hostname]);
const getSecurityLevel = (server) => server[_ns].getServerSecurityLevel(server[_hostname]);
const getBaseSecurityLevel = (server) => server[_ns].getServerBaseSecurityLevel(server[_hostname]);
const getMinSecurityLevel = (server) => server[_ns].getServerMinSecurityLevel(server[_hostname]);
const getWeakenTime = (server) => server[_ns].getWeakenTime(server[_hostname]);
const getRequiredHackingLevel = (server) => server[_ns].getServerRequiredHackingLevel(server[_hostname]);
const getRequiredPortCount = (server) => server[_ns].getServerNumPortsRequired(server[_hostname]);
const fileExists = (server, fileName) => server[_ns].fileExists(fileName, server[_hostname]);
const runningProcesses = (server) => server[_ns].ps(server[_hostname]);
const getHackStatus = (server) => {
    if (hasRootAccess(server))
        return HackStatus.Hacked;
    if (getRequiredHackingLevel(server) > getPlayerHackingLevel(server[_ns]))
        return HackStatus.NeedsLevel;
    let ports = getRequiredPortCount(server);
    if (hasBrutessh(server[_ns])) {
        server[_ns].brutessh(server[_hostname]);
        ports--;
    }
    if (hasFtpcrack(server[_ns])) {
        server[_ns].ftpcrack(server[_hostname]);
        ports--;
    }
    if (hasHttpworm(server[_ns])) {
        server[_ns].httpworm(server[_hostname]);
        ports--;
    }
    if (hasRelaysmtp(server[_ns])) {
        server[_ns].relaysmtp(server[_hostname]);
        ports--;
    }
    if (hasSqlinject(server[_ns])) {
        server[_ns].sqlinject(server[_hostname]);
        ports--;
    }
    if (ports <= 0) {
        server[_ns].nuke(server[_hostname]);
        if (!hasRootAccess(server))
            return HackStatus.NeedsPorts;
        return HackStatus.Hacked;
    }
    return HackStatus.NeedsPorts;
};

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
const update = (updatable, fn) => updatable[_update](fn);
const reset = (updatable) => updatable[_reset]();

const LEDGER_STATE_OWNER = 'ledger';
const _ns$1 = Symbol('ns');
const _name = Symbol('investor:name');
const _conf = Symbol('investor:conf');
const _state = Symbol('investor:state');
const getState = (ns) => state(ns, {}, LEDGER_STATE_OWNER);
class Investor {
    constructor(ns, name, budget /* percentage (0,100] */) {
        const host = ns.getHostname();
        if (host !== 'home') {
            throw new Error(`Investor instances can only run on the home server.`);
        }
        this[_ns$1] = ns;
        this[_name] = name;
        this[_conf] = { budget };
        this[_state] = getState(ns);
        Object.freeze(this);
    }
}
const defaultEntry = () => ({
    totalInvested: 0,
    investments: {},
});
const incr = (n, m) => typeof n === 'undefined' ? m : n + m;
const getInvestments = (investor) => investor[_state][investor[_name]] || defaultEntry();
const getBudget = (investor, name = null) => {
    const investments = getInvestments(investor);
    const money = getPlayerMoney(investor[_ns$1]);
    const { budget } = investor[_conf];
    const totalInvested = Math.floor(investments.totalInvested);
    const totalAssets = totalInvested + money;
    const allowedUse = Math.floor((totalAssets * budget) / 100) - totalInvested;
    const moneyLeft = Math.min(Math.floor(allowedUse - totalInvested), money);
    return {
        totalMoney: money,
        allowedPercentag: budget,
        invested: name === null
            ? totalInvested
            : Math.floor(investments.investments[name] || 0),
        allowedUse,
        moneyLeft,
    };
};
const tryInvest = (investor, name, price, action) => {
    const investments = getInvestments(investor);
    const money = getPlayerMoney(investor[_ns$1]);
    const { budget } = investor[_conf];
    const totalAllowedUse = (money * budget) / 100;
    const allowedUse = totalAllowedUse - investments.totalInvested;
    if (allowedUse < price)
        return false;
    if (price > money)
        return false;
    const used = action(investor[_ns$1]);
    if (used <= 0)
        return false;
    return update(investor[_state], ledger => {
        const investments = ledger[investor[_name]] || (ledger[investor[_name]] = defaultEntry());
        investments.totalInvested += used;
        investments.investments[name] = incr(investments.investments[name], used);
        return true;
    });
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
const createTerminalLogger = (ns, prefix) => (literals, ...placeholders) => ns.tprint(maybeStr(prefix) + prettifyString(literals, ...placeholders));

const _script = Symbol('tool:script');
const _ns$2 = Symbol('ns');
class Tool {
    constructor(ns, script) {
        if (!ns.fileExists(script, 'home')) {
            throw new Error('Tool does not exist on home');
        }
        this[_script] = script;
        this[_ns$2] = ns;
        Object.freeze(this);
    }
}
const maxThreads = (tool, server) => {
    const freeRam = getFreeServerRam(server);
    const cost = tool[_ns$2].getScriptRam(tool[_script], 'home');
    return Math.floor(freeRam / cost);
};
const runTool = async (tool, server, threads, args) => {
    if (!fileExists(server, tool[_script])) {
        tool[_ns$2].scp(tool[_script], 'home', getHostname(server));
    }
    return await tool[_ns$2].exec(tool[_script], getHostname(server), threads, ...args);
};

const orderBy = (array, prop, asc = true) => {
    const accessor = typeof prop === 'function' ? prop : (item) => item[prop];
    const copy = [...array];
    copy.sort((a, b) => {
        const aVal = accessor(a);
        const bVal = accessor(b);
        if (aVal < bVal)
            return asc ? -1 : 1;
        if (bVal < aVal)
            return asc ? 1 : -1;
        return 0;
    });
    return copy;
};
const findLast = (array, fn) => {
    if (array.length === 0) {
        throw new Error(`Array was empty`);
    }
    for (let i = 1; i < array.length; i++) {
        if (!fn(array[i])) {
            return array[i - 1];
        }
    }
    return array[array.length - 1];
};
const without = (array, item) => array.filter(i => i !== item);

const scanNetwork = (ns) => {
    const homeServer = {
        server: new Server(ns, 'home'),
        edges: new Set(),
        path: Object.freeze([]),
    };
    const nodes = new Map();
    nodes.set('home', homeServer);
    const queue = [homeServer];
    let node;
    while ((node = queue.shift())) {
        const neighbors = ns.scan(getHostname(node.server));
        for (const neighbor of neighbors) {
            let neighborNode = nodes.get(neighbor);
            if (!neighborNode) {
                neighborNode = {
                    server: new Server(ns, neighbor),
                    edges: new Set(),
                    path: Object.freeze([...node.path, node]),
                };
                nodes.set(neighbor, neighborNode);
                queue.push(neighborNode);
            }
            node.edges.add(neighborNode);
            neighborNode.edges.add(node);
        }
    }
    return homeServer;
};
const flattenNetwork = (root) => {
    const servers = new Set();
    const queue = [root];
    let node;
    while ((node = queue.shift())) {
        servers.add(node);
        for (const edge of node.edges) {
            if (!servers.has(edge)) {
                queue.push(edge);
            }
        }
    }
    return [...servers];
};

// initial potency of weaken threads before multipliers
const WEAKEN_THREAD_POTENCY = 0.05;
// unadjusted server growth rate, this is way more than what you actually get
const UNAJUSTED_GROWTH_RATE = 1.03;
// max server growth rate, growth rates higher than this are throttled.
const MAX_GROWTH_RATE = 1.0035;
// minimum and maximum ram exponents to purchase servers with.
const MIN_RAM_EXPONENT = 4; // 16GB
const MAX_RAM_EXPONENT = 20; // 2^20 GB
// scripts to copy to all managed servers
const WEAKEN_TOOL_NAME = 'weak-target.js';
const GROW_TOOL_NAME = 'grow-target.js';
const HACK_TOOL_NAME = 'hack-target.js';
// added arg to all started tools to keep track of origin
const ORIGIN_ARG = '--origin=server-farm';
const defaultState = {
    minRamExponent: MIN_RAM_EXPONENT,
    nextServerIndex: 0,
    currentTargets: 0,
};
// --- RUNTIME VARIABLES ---
// tools
let weakenTool;
let growTool;
let hackTool;
// multipliers for player abilities
let playerHackingMoneyMult;
let playerHackingGrowMult;
let bitnodeGrowMult = 1;
let bitnodeWeakenMult = 1;
// --- FUNCTIONS ---
const actualWeakenPotency = () => bitnodeWeakenMult * WEAKEN_THREAD_POTENCY;
const getInfo = (server) => {
    if (!hasRootAccess(server))
        return null;
    const maxMoney = getMaxMoney(server);
    const growthRate = getGrowth(server);
    const minSec = getMinSecurityLevel(server);
    const baseSec = getBaseSecurityLevel(server);
    const weakenTime = getWeakenTime(server);
    const currentSec = getSecurityLevel(server);
    const rank = (maxMoney * growthRate) / (weakenTime * baseSec);
    const currentRank = currentSec < minSec * 1.1 ? rank * (minSec * 1.1 - currentSec + 1) : rank;
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
const deleteSingleServer = (ns, servers, logger) => {
    let minRam = Number.MAX_SAFE_INTEGER;
    let minServer = null;
    for (const server of servers) {
        const [ram] = ns.getServerRam(server);
        if (ram < minRam) {
            minRam = ram;
            minServer = server;
        }
    }
    if (minServer !== null) {
        logger `Deleting server ${minServer}`;
        ns.deleteServer(minServer);
    }
};
const maybeBuyServer = (ns, investor, logger, state$$1) => {
    const servers = ns.getPurchasedServers();
    const budget = getBudget(investor);
    const limit = ns.getPurchasedServerLimit();
    return update(state$$1, state$$1 => {
        // done, all servers max upgraded, nothing more to do
        if (state$$1.minRamExponent > MAX_RAM_EXPONENT)
            return false;
        // check if we can afford a new server
        if (ns.getPurchasedServerCost(Math.pow(2, state$$1.minRamExponent)) >=
            budget.moneyLeft) {
            return false;
        }
        // see if we can go for more expensive servers
        let ramExponent = state$$1.minRamExponent;
        while (ramExponent < MAX_RAM_EXPONENT - 1 &&
            ns.getPurchasedServerCost(Math.pow(2, ramExponent + 1)) < budget.moneyLeft) {
            ramExponent += 1;
        }
        const cost = ns.getPurchasedServerCost(Math.pow(2, ramExponent));
        return tryInvest(investor, 'host', cost, ns => {
            if (servers.length >= limit)
                deleteSingleServer(ns, servers, logger);
            const newServer = ns.purchaseServer(`farm-${state$$1.nextServerIndex++}`, Math.pow(2, ramExponent));
            if (!newServer || newServer.trim().length === 0) {
                state$$1.nextServerIndex--;
                return 0;
            }
            state$$1.minRamExponent = ramExponent;
            logger `Purchased new server ${newServer} with 2^${ramExponent} (${Math.pow(2, ramExponent)}GB) ram`;
            return cost;
        });
    });
};
const maybeHackServer = (ns, logger) => {
    let newlyHacked = false;
    const network = scanNetwork(ns);
    for (const node of flattenNetwork(network)) {
        const hacked = hasRootAccess(node.server);
        if (!hacked && getHackStatus(node.server) === HackStatus.Hacked) {
            newlyHacked = true;
            logger `Hacked server ${getHostname(node.server)}`;
        }
    }
    return newlyHacked;
};
const getAllServers = (ns) => {
    const network = scanNetwork(ns);
    return [
        ...flattenNetwork(network)
            .map(node => node.server)
            .filter(hasRootAccess)
            .filter(s => getHostname(s) !== 'home'),
    ];
};
const getWorkerServers = (ns) => getAllServers(ns).filter(server => getServerRam(server).total > 2);
const getTargetServers = (ns) => {
    const purchasedServers = new Set(ns.getPurchasedServers());
    return getAllServers(ns)
        .filter(s => getMaxMoney(s) > 0)
        .filter(s => !purchasedServers.has(getHostname(s)));
};
const adjustedGrowthRate = (target) => Math.min(MAX_GROWTH_RATE, 1 + (UNAJUSTED_GROWTH_RATE - 1) / target.minSec);
const serverGrowthPercentage = (target) => (target.growthRate * bitnodeGrowMult * playerHackingGrowMult) / 100;
const targetGrowthCoefficient = (target) => target.maxMoney / Math.max(getAvailableMoney(target.server), 1);
const cyclesNeededForGrowthCoefficient = (target) => Math.log(targetGrowthCoefficient(target)) /
    Math.log(adjustedGrowthRate(target));
const getGrowThreadsNeeded = (target) => Math.ceil(cyclesNeededForGrowthCoefficient(target) / serverGrowthPercentage(target));
const getWeakenThreadsNeeded = (target) => Math.ceil((getSecurityLevel(target.server) - target.minSec) / actualWeakenPotency());
const weaken = async (target, workers) => {
    const neededThreads = getWeakenThreadsNeeded(target);
    const minServer = findLast(workers, server => maxThreads(weakenTool, server) >= neededThreads);
    const threads = Math.min(maxThreads(weakenTool, minServer), neededThreads);
    await runTool(weakenTool, minServer, threads, [
        getHostname(target.server),
        ORIGIN_ARG,
    ]);
    const freeRam = getFreeServerRam(minServer);
    if (freeRam > 5) {
        return orderBy(workers, getFreeServerRam, false);
    }
    return without(workers, minServer);
};
const grow = async (target, workers) => {
    const neededThreads = getGrowThreadsNeeded(target);
    const minServer = findLast(workers, server => maxThreads(growTool, server) >= neededThreads);
    const threads = Math.min(maxThreads(growTool, minServer), neededThreads);
    await runTool(growTool, minServer, threads, [
        getHostname(target.server),
        ORIGIN_ARG,
    ]);
    const freeRam = getFreeServerRam(minServer);
    if (freeRam > 5) {
        return orderBy(workers, getFreeServerRam, false);
    }
    return without(workers, minServer);
};
const hack = async (target, workers) => {
    // TODO: Calculate best hacking thread count
    const [worker, ...rest] = workers;
    const threads = maxThreads(hackTool, worker);
    await runTool(hackTool, worker, threads, [
        getHostname(target.server),
        ORIGIN_ARG,
    ]);
    return rest;
};
const scheduleServers = async (ns, logger, state$$1, workers, targets) => {
    if (targets.length === 0)
        return;
    if (workers.length === 0)
        return;
    const [target, ...restTargets] = targets;
    const sec = getSecurityLevel(target.server);
    if (sec > target.minSec) {
        const restWorkers = await weaken(target, workers);
        return await scheduleServers(ns, logger, state$$1, restWorkers, restTargets);
    }
    const money = getAvailableMoney(target.server);
    if (money < target.maxMoney) {
        const restWorkers = await grow(target, workers);
        return await scheduleServers(ns, logger, state$$1, restWorkers, restTargets);
    }
    const restWorkers = await hack(target, workers);
    return await scheduleServers(ns, logger, state$$1, restWorkers, restTargets);
};
const startWork = async (ns, logger, state$$1) => {
    const workerServers = orderBy(getWorkerServers(ns), getFreeServerRam, false).filter(s => getFreeServerRam(s) > 5);
    const existingTargets = new Set(workerServers
        .reduce((procs, s) => [...procs, ...runningProcesses(s)], [])
        .filter(p => p.args.includes(ORIGIN_ARG))
        .map(p => p.args[0]));
    const untargeted = (s) => !existingTargets.has(getHostname(s));
    const targetServers = orderBy(getTargetServers(ns)
        .filter(untargeted)
        .map(getInfo)
        .filter(Boolean), 'currentRank');
    await scheduleServers(ns, logger, state$$1, workerServers, targetServers);
};
const main = async (ns) => {
    ns.disableLog('ALL');
    const state$$1 = state(ns, defaultState);
    const term = createTerminalLogger(ns);
    const logger = createLogger(ns);
    const [startTimeStr] = ns.args;
    const startTime = parseInt(startTimeStr, 10);
    if (Date.now() - startTime < 60 * 1000 /* 60 seconds */) {
        reset(state$$1);
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
        maybeBuyServer(ns, investor, term, state$$1);
        // Then, try to hack any servers we are now high enough level for (or has the tools for)
        maybeHackServer(ns, term);
        await startWork(ns, logger, state$$1);
        await ns.sleep(10000);
    }
};

export { main };
