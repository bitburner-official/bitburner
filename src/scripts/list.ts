import { HackStatus, getHackStatus, getHostname } from '../core/server';
import { flattenNetwork, scanNetwork } from '../utils/network';

import { BitBurner as NS } from 'bitburner';
import { createTerminalLogger } from '../utils/print';

export const main = (ns: NS) => {
  const terminal = createTerminalLogger(ns);
  const network = scanNetwork(ns);
  for (const node of flattenNetwork(network)) {
    const status = getHackStatus(node.server);
    terminal`${getHostname(node.server)}: ${HackStatus[status]}`;
  }
};
