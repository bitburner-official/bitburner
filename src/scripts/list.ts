import {
  HackStatus,
  Server,
  getAvailableMoney,
  getHackStatus,
  getHostname,
  getRequiredHackingLevel,
  getRequiredPortCount,
} from '../core/server';
import { flattenNetwork, scanNetwork } from '../utils/network';

import { BitBurner as NS } from 'bitburner';
import { createTerminalLogger } from '../utils/print';
import { parseArgs } from '../utils/argparse';

const lt = `<`;
const gt = `>`;
const slash = `/`;
const getServerLink = (server: Server) =>
  `${lt}a class="scan-analyze-link"${gt}${getHostname(
    server,
  )}${lt}${slash}a${gt}`;

export const main = (ns: NS) => {
  const args = parseArgs(ns, {
    boolean: ['hacked', 'no-summary', 'money'],
    alias: {
      hacked: 'h',
      money: 'm',
      'no-summary': 'n',
    },
    default: {
      hacked: false,
      money: false,
      'no-summary': false,
    },
  });

  const hackedOnly: boolean = args.h;
  const moneyOnly: boolean = args.m;
  const noSummary: boolean = args.n;
  const terminal = createTerminalLogger(ns);
  const network = scanNetwork(ns);
  let flattened = flattenNetwork(network).map(node => ({
    server: node.server,
    status: getHackStatus(node.server),
  }));

  if (hackedOnly) {
    flattened = flattened.filter(({ status }) => status === HackStatus.Hacked);
  }

  if (moneyOnly) {
    flattened = flattened.filter(({ server }) => getAvailableMoney(server) > 0);
  }

  const hacked = flattened.filter(({ status }) => status === HackStatus.Hacked);
  const needsLevel = flattened.filter(
    ({ status }) => status === HackStatus.NeedsLevel,
  );
  const needsPorts = flattened.filter(
    ({ status }) => status === HackStatus.NeedsPorts,
  );

  let output = false;
  if (hacked.length > 0) {
    output = true;
    terminal`=== Hacked ===`;
    for (const { server } of hacked) {
      if (moneyOnly) {
        terminal`${getServerLink(server)}: \$${getAvailableMoney(server)}`;
      } else {
        terminal`${getServerLink(server)}`;
      }
    }
  }

  if (needsLevel.length > 0) {
    if (output) {
      terminal``;
    }

    output = true;
    terminal`=== Needs level ===`;
    for (const { server } of needsLevel) {
      terminal`${getServerLink(server)}: Needs level ${getRequiredHackingLevel(
        server,
      )}`;
    }
  }

  if (needsPorts.length > 0) {
    if (output) {
      terminal``;
    }

    output = true;
    terminal`=== Needs ports ===`;
    for (const { server } of needsPorts) {
      terminal`${getServerLink(server)}: Needs ports ${getRequiredPortCount(
        server,
      )}`;
    }
  }

  if (!noSummary) {
    if (output) {
      terminal``;
    }

    output = true;
    terminal`=== Summary ===`;
    terminal`Hacked: ${hacked.length}`;
    terminal`Needs level: ${needsLevel.length}`;
    terminal`Needs ports: ${needsPorts.length}`;
  }
};
