import { HackStatus, getHackStatus, getHostname } from '../core/server';
import { findNode, scanNetwork } from '../utils/network';

import { BitBurner as NS } from 'bitburner';
import { createTerminalLogger } from '../utils/print';

export const main = (ns: NS) => {
  const [hostname] = ns.args;
  const terminal = createTerminalLogger(ns);
  const network = scanNetwork(ns);
  const node = findNode(network, node => getHostname(node.server) === hostname);
  if (node === null) {
    terminal`Host ${hostname} not found.`;
  } else {
    terminal`Path to ${getHostname(node.server)} from home:`;
    for (const pathNode of node.path) {
      terminal`- ${getHostname(pathNode.server)}`;
    }
    terminal`- ${getHostname(node.server)}`;
  }
};
