import { d as HackStatus, e as getHackStatus, b as getHostname } from './chunk.4117d657.js';
import { a as flattenNetwork, b as scanNetwork } from './chunk.663dd915.js';
import { h as createTerminalLogger } from './chunk.06fc0bd6.js';

const main = (ns) => {
    const terminal = createTerminalLogger(ns);
    const network = scanNetwork(ns);
    for (const node of flattenNetwork(network)) {
        const status = getHackStatus(node.server);
        terminal `${getHostname(node.server)}: ${HackStatus[status]}`;
    }
};

export { main };
