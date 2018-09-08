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
const hasRootAccess = (server) => server[_ns].hasRootAccess(server[_hostname]);
const getRequiredHackingLevel = (server) => server[_ns].getServerRequiredHackingLevel(server[_hostname]);
const getRequiredPortCount = (server) => server[_ns].getServerNumPortsRequired(server[_hostname]);
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
    const moneyLeft = Math.floor(allowedUse - totalInvested);
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

const MIN_RAM_EXPONENT = 4;
const MAX_RAM_EXPONENT = 20;
const SCRIPT_FILES = ['weaken.js', 'work.js'];
const WORK_SCRIPT = 'work.js';
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
const maybeBuyServer = (ns, investor, logger) => {
    const servers = ns.getPurchasedServers();
    const budget = getBudget(investor);
    const minRamExponent = getPurchasedServersMinRamExponent(ns, servers);
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
        if (ramExponent <= minRamExponent)
            return false;
        ramExponent -= 1;
    }
    const cost = ns.getPurchasedServerCost(Math.pow(2, ramExponent));
    return tryInvest(investor, 'host', cost, ns => {
        const newServer = ns.purchaseServer('farm', Math.pow(2, ramExponent));
        if (!newServer || newServer.trim().length === 0)
            return 0;
        logger `Purchased new server ${newServer} with 2^${ramExponent} (${Math.pow(2, ramExponent)}GB) ram`;
        ns.scp(SCRIPT_FILES, 'home', newServer);
        return cost;
    });
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
    }
    return newlyHacked;
};
const getAllServers = (ns) => {
    const network = scanNetwork(ns);
    return [
        ...ns.getPurchasedServers(),
        ...flattenNetwork(network)
            .filter(node => getServerRam(node.server).total > 2)
            .map(node => getHostname(node.server)),
    ];
};
const retargetServers = async (ns, host, logger) => {
    const maxMoney = ns.getServerMaxMoney(host);
    const minSec = ns.getServerMinSecurityLevel(host);
    //const baseSec = ns.getServerBaseSecurityLevel(host);
    const minMoney = maxMoney * 0.9;
    const maxSec = minSec + 10;
    const servers = getAllServers(ns);
    const ramUsage = ns.getScriptRam(WORK_SCRIPT, 'home');
    for (const server of servers) {
        if (server === 'home')
            continue;
        if (ns.scriptRunning(WORK_SCRIPT, server)) {
            const processInfo = ns
                .ps(server)
                .find(info => info.filename === WORK_SCRIPT);
            if (processInfo.args[0] === host) {
                continue;
            }
            ns.scriptKill(WORK_SCRIPT, server);
            await ns.sleep(200);
        }
        const [ram, used] = ns.getServerRam(server);
        const threads = Math.floor((ram - used) / ramUsage);
        if (threads < 1) {
            logger `Can't run script on host ${server}, not enough RAM`;
            continue;
        }
        await ns.exec(WORK_SCRIPT, server, threads, host, String(maxSec), String(minMoney));
    }
};
const main = async (ns) => {
    ns.disableLog('ALL');
    const term = createTerminalLogger(ns);
    const logger = createLogger(ns);
    const investor = new Investor(ns, 'servers', 40);
    await retargetServers(ns, 'foodnstuff', logger);
    while (true) {
        // First, try to acquire new servers, if we can afford it
        let newFarmServer = maybeBuyServer(ns, investor, term);
        // Then, try to hack any servers we are now high enough level for (or has the tools for)
        let newHackedServer = maybeHackServer(ns, term);
        if (newFarmServer || newHackedServer) {
            await retargetServers(ns, 'foodnstuff', logger);
        }
        await ns.sleep(10000);
    }
};

export { main };
