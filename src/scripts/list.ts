import {
  HackStatus,
  Server,
  getAvailableMoney,
  getHackStatus,
  getHostname,
  getMaxMoney,
  getMinSecurityLevel,
  getRequiredHackingLevel,
  getRequiredPortCount,
  getSecurityLevel,
  isPlayerOwned,
} from '../core/server';
import { flattenNetwork, scanNetwork } from '../utils/network';

import { BitBurner as NS } from 'bitburner';
import { createTerminalLogger } from '../utils/print';
import { parseArgs } from '../utils/argparse';

const getServerDisplay = (server: Server) => `${getHostname(server)}`;
const getMoneyDisplay = (server: Server) => {
  const money = getAvailableMoney(server);
  const maxMoney = getMaxMoney(server);
  const sec = getSecurityLevel(server);
  const minSec = getMinSecurityLevel(server);
  return `${money.toLocaleString('en-us', {
    style: 'currency',
    currency: 'USD',
  })} (${(money / maxMoney).toLocaleString('en-us', {
    style: 'percent',
  })}) ${sec} SEC/${minSec} MIN`;
};

export const main = (ns: NS) => {
  const args = parseArgs(ns, {
    boolean: ['hacked', 'no-summary', 'money', 'include-owned'],
    alias: {
      hacked: 'h',
      money: 'm',
      'include-owned': 'o',
      'no-summary': 'n',
    },
    default: {
      hacked: false,
      money: false,
      'include-owned': false,
      'no-summary': false,
    },
  });

  const hackedOnly: boolean = args.h;
  const moneyOnly: boolean = args.m;
  const noSummary: boolean = args.n;
  const includeOwned: boolean = args.o;
  const terminal = createTerminalLogger(ns);
  const network = scanNetwork(ns);
  let flattened = flattenNetwork(network).map(node => ({
    server: node.server,
    status: getHackStatus(node.server),
  }));

  if (!includeOwned) {
    flattened = flattened.filter(({ server }) => !isPlayerOwned(server));
  }

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
        terminal`${getServerDisplay(server)}: ${getMoneyDisplay(server)}`;
      } else {
        terminal`${getServerDisplay(server)}`;
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
      terminal`${getServerDisplay(
        server,
      )}: Needs level ${getRequiredHackingLevel(server)}`;
    }
  }

  if (needsPorts.length > 0) {
    if (output) {
      terminal``;
    }

    output = true;
    terminal`=== Needs ports ===`;
    for (const { server } of needsPorts) {
      terminal`${getServerDisplay(server)}: Needs ports ${getRequiredPortCount(
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
    if (moneyOnly) {
      const money = hacked
        .filter(({ server }) => !isPlayerOwned(server))
        .reduce((num, { server }) => num + getAvailableMoney(server), 0);

      terminal`Total available money: \$${money}`;
    }
  }
};
