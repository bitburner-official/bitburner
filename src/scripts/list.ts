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
  getServerRam,
  isPlayerOwned,
} from '../core/server';
import { fMoney, fNumber, fRam } from '../utils/format';
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
  return `${fMoney(money)} (${fMoney(money / maxMoney)}) ${fNumber(
    sec,
  )} SEC/${fNumber(minSec)} MIN`;
};

export const main = (ns: NS) => {
  const args = parseArgs(ns, {
    boolean: ['hacked', 'no-summary', 'money', 'include-owned', 'help'],
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

  const help: boolean = args.help;
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

  if (help) {
    terminal`=== LIST ===`;
    terminal`h|hacked          only hacked nodes`;
    terminal`m|money           show server money and security for hacked nodes`;
    terminal`o|include-owned   include owned servers (home and purchased servers) in output`;
    terminal`n|no-summary      don't print summary`;
    terminal`help              print this help`;
    return;
  }

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
      terminal`${getServerDisplay(server)}: Needs level ${fNumber(
        getRequiredHackingLevel(server),
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
      terminal`${getServerDisplay(server)}: Needs ports ${fNumber(
        getRequiredPortCount(server),
      )}`;
    }
  }

  if (!noSummary) {
    if (output) {
      terminal``;
    }

    output = true;
    terminal`=== Summary ===`;
    if (hacked.length > 0) {
      terminal`Hacked: ${fNumber(hacked.length)}`;
    }

    if (needsLevel.length > 0) {
      const nextLevel = needsLevel.reduce(
        (min, { server }) => Math.min(min, getRequiredHackingLevel(server)),
        Number.MAX_SAFE_INTEGER,
      );
      terminal`Needs level: ${fNumber(needsLevel.length)} (next: ${fNumber(
        nextLevel,
      )})`;
    }

    if (needsPorts.length > 0) {
      const nextPorts = needsPorts.reduce(
        (min, { server }) => Math.min(min, getRequiredPortCount(server)),
        5,
      );
      terminal`Needs ports: ${fNumber(needsPorts.length)} (next: ${fNumber(
        nextPorts,
      )})`;
    }

    if (moneyOnly) {
      const moneyServers = hacked.filter(
        ({ server }) => !isPlayerOwned(server),
      );
      const money = moneyServers.reduce(
        (num, { server }) => num + getAvailableMoney(server),
        0,
      );
      const potential = moneyServers.reduce(
        (num, { server }) => num + getMaxMoney(server),
        0,
      );
      const totalRam = flattened.reduce(
        (num, { server }) => num + getServerRam(server).total,
        0,
      );

      terminal`Total available money: ${fMoney(money)}`;
      terminal`Total potential money: ${fMoney(potential)}`;
      terminal`Total ram available: ${fRam(totalRam)}`;
    }
  }
};
