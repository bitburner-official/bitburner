import { e as HackStatus, f as getHackStatus, c as getHostname } from './chunk.8269008e.js';
import { a as flattenNetwork, b as scanNetwork } from './chunk.ec8a53b9.js';
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
