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
const findNode = (root, match) => {
    const servers = new Set();
    const queue = [root];
    let node;
    while ((node = queue.shift())) {
        if (match(node)) {
            return node;
        }
        servers.add(node);
        for (const edge of node.edges) {
            if (!servers.has(edge)) {
                queue.push(edge);
            }
        }
    }
    return null;
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
    const [hostname] = ns.args;
    const terminal = createTerminalLogger(ns);
    const network = scanNetwork(ns);
    const node = findNode(network, node => getHostname(node.server) === hostname);
    if (node === null) {
        terminal `Host ${hostname} not found.`;
    }
    else {
        terminal `Path to ${getHostname(node.server)} from home:`;
        for (const pathNode of node.path) {
            terminal `- ${getHostname(pathNode.server)}`;
        }
        terminal `- ${getHostname(node.server)}`;
    }
};

export { main };
