import { b as getHostname } from './chunk.4117d657.js';
import { c as findNode, b as scanNetwork } from './chunk.663dd915.js';
import { h as createTerminalLogger } from './chunk.06fc0bd6.js';

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
