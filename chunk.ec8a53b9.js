import { a as Server, c as getHostname } from './chunk.8269008e.js';

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

export { flattenNetwork as a, scanNetwork as b, findNode as c };
