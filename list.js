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
const createTerminalLogger = (ns, prefix) => (literals, ...placeholders) => ns.tprint(maybeStr(prefix) + prettifyString(literals, ...placeholders));

const main = (ns) => {
    const terminal = createTerminalLogger(ns);
    const network = scanNetwork(ns);
    for (const node of flattenNetwork(network)) {
        const status = getHackStatus(node.server);
        terminal `${getHostname(node.server)}: ${HackStatus[status]}`;
    }
};

export { main };
