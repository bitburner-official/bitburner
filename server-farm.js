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

const LEDGER_FILE = 'ledger.json';
const _ns$1 = Symbol('ns');
const _name = Symbol('investor:name');
const _conf = Symbol('investor:conf');
class Investor {
    constructor(ns, name, budget /* percentage (0,100] */) {
        const host = ns.getHostname();
        if (host !== 'home') {
            throw new Error(`Investor instances can only run on the home server.`);
        }
        this[_ns$1] = ns;
        this[_name] = name;
        this[_conf] = { budget };
        Object.freeze(this);
    }
}
const incr = (n, m) => typeof n === 'undefined' ? m : n + m;
const readLedger = (investor) => {
    const text = investor[_ns$1].read(LEDGER_FILE);
    if (text.trim().length === 0) {
        return {};
    }
    return JSON.parse(text);
};
const getInvestments = (investor) => readLedger(investor)[investor[_name]] || {
    totalInvested: 0,
    investments: {},
};
const updateLedger = (investor, investments) => {
    const ledger = readLedger(investor);
    ledger[investor[_name]] = investments;
    investor[_ns$1].write(LEDGER_FILE, JSON.stringify(ledger, null, 2), 'w');
};
const getBudget = (investor, name = null) => {
    const investments = getInvestments(investor);
    const money = getPlayerMoney(investor[_ns$1]);
    const { budget } = investor[_conf];
    const allowedUse = Math.floor((money * budget) / 100);
    const totalInvested = Math.floor(investments.totalInvested);
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
    investments.totalInvested += used;
    investments.investments[name] = incr(investments.investments[name], used);
    updateLedger(investor, investments);
    return true;
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
                if (data.hasOwnProperty(part)) {
                    data = data[part];
                }
                else {
                    throw new Error(`Object has no property '${part}' (part of '${path.join('.')}')`);
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

// --- CONSTANTS ---
// track how costly (in security) a growth/hacking thread is.
const GROWTH_THREAD_HARDENING = 0.004;
// initial potency of weaken threads before multipliers
const WEAKEN_THREAD_POTENCY = 0.05;
// unadjusted server growth rate, this is way more than what you actually get
const UNAJUSTED_GROWTH_RATE = 1.03;
// max server growth rate, growth rates higher than this are throttled.
const MAX_GROWTH_RATE = 1.0035;
// the delay that it can take for a script to start, used to pessimistically schedule things in advance
const QUEUE_DELAY = 12000;
// the max number of targets this daemon will run workers against to avoid running out of IRL ram
const MAX_TARGETS = 5;
// minimum and maximum ram exponents to purchase servers with.
const MIN_RAM_EXPONENT = 4; // 16GB
const MAX_RAM_EXPONENT = 20; // 2^20 GB
// scripts to copy to all managed servers
const WEAKEN_TOOL_NAME = 'weak-target.js';
const GROW_TOOL_NAME = 'grow-target.js';
const HACK_TOOL_NAME = 'hack-target.js';
const TOOL_NAMES = Object.freeze([
    WEAKEN_TOOL_NAME,
    GROW_TOOL_NAME,
    HACK_TOOL_NAME,
]);
const SCRIPT_FILES = Object.freeze([
    ...TOOL_NAMES,
    'weaken.js',
    'work.js',
]);
const defaultState = {
    nextServerIndex: 0,
    currentTargets: 0,
};
// tools
let tools = new Map();
// multipliers for player abilities
let playerHackingMoneyMult;
let playerHackingGrowMult;
let bitnodeGrowMult = 1;
let bitnodeWeakenMult = 1;
// --- FUNCTIONS ---
const actualWeakenPotency = () => bitnodeWeakenMult * WEAKEN_THREAD_POTENCY;
const getTool = (tool) => tools.get(tool);
const getMaxThreads = (tool, workers) => {
    const workerServers = orderBy(workers, getFreeServerRam, false);
    let maxThreads = 0;
    for (const worker of workerServers) {
        const threadsHere = Math.floor(getFreeServerRam(worker) / tool.cost);
        if (!tool.allowThreadSpreading)
            return threadsHere;
        if (threadsHere <= 0)
            break;
        maxThreads += threadsHere;
    }
    return maxThreads;
};
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
const getPurchasedServersMinRamExponent = (ns, servers) => {
    if (servers.length === 0) {
        return MIN_RAM_EXPONENT;
    }
    const limit = ns.getPurchasedServerLimit();
    let minRamExp = MAX_RAM_EXPONENT;
    for (const server of servers) {
        const [ram] = ns.getServerRam(server);
        const expo = Math.log2(ram);
        if (expo < minRamExp)
            minRamExp = expo;
    }
    if (servers.length === limit) {
        minRamExp += 1;
    }
    return minRamExp >= MAX_RAM_EXPONENT ? null : minRamExp;
};
const maybeBuyServer = (ns, investor, logger, state$$1) => {
    const servers = ns.getPurchasedServers();
    const budget = getBudget(investor);
    const minRamExponent = getPurchasedServersMinRamExponent(ns, servers);
    const limit = ns.getPurchasedServerLimit();
    // done, all servers max upgraded, nothing more to do
    if (minRamExponent === null)
        return false;
    let ramExponent = minRamExponent;
    while (ns.getPurchasedServerCost(Math.pow(2, ramExponent)) < budget.moneyLeft &&
        ramExponent < MAX_RAM_EXPONENT) {
        ramExponent += 1;
    }
    if (ns.getPurchasedServerCost(Math.pow(2, ramExponent)) > budget.moneyLeft) {
        // We can't afford any new servers
        if (ramExponent > minRamExponent)
            return false;
        ramExponent -= 1;
    }
    const cost = ns.getPurchasedServerCost(Math.pow(2, ramExponent));
    return tryInvest(investor, 'host', cost, ns => {
        if (servers.length >= limit)
            deleteSingleServer(ns, servers, logger);
        const newServer = ns.purchaseServer(`farm-${state$$1.nextServerIndex++}`, Math.pow(2, ramExponent));
        if (!newServer || newServer.trim().length === 0)
            return 0;
        logger `Purchased new server ${newServer} with 2^${ramExponent} (${Math.pow(2, ramExponent)}GB) ram`;
        ns.scp(SCRIPT_FILES, 'home', newServer);
        return cost;
    });
};
const ensureHasFiles = (ns, server, files) => {
    for (const file of files) {
        if (!fileExists(server, file)) {
            ns.scp(file, 'home', getHostname(server));
        }
    }
};
const maybeHackServer = (ns, logger) => {
    let newlyHacked = false;
    const network = scanNetwork(ns);
    for (const node of flattenNetwork(network)) {
        const hacked = hasRootAccess(node.server);
        if (!hacked && getHackStatus(node.server) === HackStatus.Hacked) {
            newlyHacked = true;
            ns.scp(SCRIPT_FILES, 'home', getHostname(node.server));
            logger `Hacked server ${getHostname(node.server)}`;
        }
        ensureHasFiles(ns, node.server, SCRIPT_FILES);
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
const isTargeting = (server, workers) => {
    for (const worker of workers) {
        for (const process of runningProcesses(worker)) {
            if (TOOL_NAMES.includes(process.filename) &&
                process.args[0] === getHostname(server)) {
                if (process.args.length > 4 && process.args[4] !== 'prep') {
                    return true;
                }
            }
        }
    }
    return false;
};
const isPrepping = (server, workers) => {
    for (const worker of workers) {
        for (const process of runningProcesses(worker)) {
            if (TOOL_NAMES.includes(process.filename) &&
                process.args[0] === getHostname(server)) {
                if (process.args.length > 4 && process.args[4] === 'prep') {
                    return true;
                }
            }
        }
    }
    return false;
};
const adjustedGrowthRate = (target) => Math.min(MAX_GROWTH_RATE, 1 + (UNAJUSTED_GROWTH_RATE - 1) / target.minSec);
const serverGrowthPercentage = (target) => (target.growthRate * bitnodeGrowMult * playerHackingGrowMult) / 100;
const targetGrowthCoefficient = (target) => target.maxMoney / Math.max(getAvailableMoney(target.server), 1);
const cyclesNeededForGrowthCoefficient = (target) => Math.log(targetGrowthCoefficient(target)) /
    Math.log(adjustedGrowthRate(target));
const getGrowThreadsNeeded = (target) => Math.ceil(cyclesNeededForGrowthCoefficient(target) / serverGrowthPercentage(target));
const getWeakenThreadsNeeded = (target) => Math.ceil((getSecurityLevel(target.server) - target.minSec) / actualWeakenPotency());
const arbitraryExecution = async (ns, tool, threads, workers, args) => {
    const workerServers = orderBy(workers, getFreeServerRam, false);
    let totalThreads = 0;
    for (const server of workerServers) {
        // we've done it, move on.
        if (threads <= 0)
            break;
        const maxThreadsHere = Math.min(threads, Math.floor(getFreeServerRam(server) / tool.cost));
        if (maxThreadsHere <= 0)
            continue;
        threads -= maxThreadsHere;
        totalThreads += maxThreadsHere;
        ensureHasFiles(ns, server, [tool.name]);
        await ns.exec(tool.name, getHostname(server), maxThreadsHere, ...args.map(String));
        if (!tool.allowThreadSpreading)
            return true;
    }
    return totalThreads > 0;
};
const prepServer = async (ns, target, workerServers, logger) => {
    // once we're in scheduling mode, presume prep server is to be skipped.
    if (isTargeting(target.server, workerServers))
        return;
    const now = Date.now();
    if (getSecurityLevel(target.server) > target.minSec ||
        getAvailableMoney(target.server) < target.maxMoney) {
        const weakenTool = getTool('weaken');
        let weakenForGrowthThreadsNeeded = 0;
        if (getAvailableMoney(target.server) < target.maxMoney) {
            const growTool = getTool('grow');
            const growThreadsAllowable = getMaxThreads(growTool, workerServers);
            const growThreadsNeeded = getGrowThreadsNeeded(target);
            let trueGrowThreadsNeeded = Math.min(growThreadsAllowable, growThreadsNeeded);
            weakenForGrowthThreadsNeeded = Math.ceil((trueGrowThreadsNeeded * GROWTH_THREAD_HARDENING) /
                actualWeakenPotency());
            const growThreadThreshold = (growThreadsAllowable - growThreadsNeeded) *
                (growTool.cost / weakenTool.cost);
            let growThreadsReleased = (weakenTool.cost / growTool.cost) *
                (weakenForGrowthThreadsNeeded + getWeakenThreadsNeeded(target));
            if (growThreadThreshold >= growThreadsReleased) {
                growThreadsReleased = 0;
            }
            trueGrowThreadsNeeded -= growThreadsReleased;
            if (trueGrowThreadsNeeded > 0) {
                logger `Prepping ${target.server} [grow].`;
                await arbitraryExecution(ns, growTool, trueGrowThreadsNeeded, workerServers, [getHostname(target.server), now, now, 0, 'prep']);
            }
        }
        const threadsNeeded = getWeakenThreadsNeeded(target) + weakenForGrowthThreadsNeeded;
        const threadSleep = getWeakenTime(target.server) * 1000 * QUEUE_DELAY;
        const threadsAllowable = getMaxThreads(weakenTool, workerServers);
        const trueThreads = Math.min(threadsAllowable, threadsNeeded);
        if (trueThreads > 0) {
            logger `Prepping ${target.server} [weaken], resting for ${Math.floor(threadSleep / 1000)} seconds.`;
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
const retargetServers = async (ns, logger, state$$1) => {
    const workerServers = orderBy(getWorkerServers(ns), getFreeServerRam, false);
    const targetServers = orderBy(getTargetServers(ns)
        .map(getInfo)
        .filter(Boolean), 'currentRank');
    if (state$$1.currentTargets < MAX_TARGETS) {
        for (const target of targetServers) {
            if (state$$1.currentTargets >= MAX_TARGETS)
                break;
            // now don't do anything to it until prep finishes, because it is in a resting state.
            if (isPrepping(target.server, workerServers))
                continue;
            // if the target is in a resting state (we have scripts running against it), proceed to the next target.
            if (isTargeting(target.server, workerServers))
                continue;
            // increment the target counter, consider this an optimal target
            state$$1.currentTargets++;
            // perform weakening and initial growth until the server is "perfected"
            await prepServer(ns, target, workerServers, logger);
            // now don't do anything to it until prep finishes, because it is in a resting state.
            if (isPrepping(target.server, workerServers))
                continue;
            // the server isn't optimized, this means we're out of ram from a more optimal target
            if (getSecurityLevel(target.server) > target.minSec ||
                getAvailableMoney(target.server) < target.maxMoney)
                continue;
            // adjust the percentage to steal until it's able to rapid fire as many as it can
            //await optimizePerformanceMetrics(ns, target, workerServers);
            // once conditions are optimal, fire barrage after barrage of cycles in a schedule
            //await performScheduling(ns, target, workerServers);
        }
    }
};
const registerTool = (ns, short, name, allowDistributed = false) => {
    const tool = Object.freeze({
        name,
        short,
        cost: ns.getScriptRam(name, 'home'),
        allowThreadSpreading: allowDistributed,
    });
    tools.set(short, tool);
};
const main = async (ns) => {
    ns.disableLog('ALL');
    const state$$1 = state(ns, defaultState);
    const term = createTerminalLogger(ns);
    const logger = createLogger(ns);
    registerTool(ns, 'weaken', WEAKEN_TOOL_NAME, true);
    registerTool(ns, 'grow', GROW_TOOL_NAME);
    registerTool(ns, 'hack', HACK_TOOL_NAME);
    const mults = ns.getHackingMultipliers();
    playerHackingGrowMult = mults.growth;
    playerHackingMoneyMult = mults.money;
    const investor = new Investor(ns, 'servers', 400);
    await retargetServers(ns, logger, state$$1);
    while (true) {
        // First, try to acquire new servers, if we can afford it
        let newFarmServer = maybeBuyServer(ns, investor, term, state$$1);
        // Then, try to hack any servers we are now high enough level for (or has the tools for)
        let newHackedServer = maybeHackServer(ns, term);
        if (newFarmServer || newHackedServer) {
            await retargetServers(ns, logger, state$$1);
        }
        await ns.sleep(10000);
    }
};

export { main };
