import {
  getPlayerHackingLevel,
  hasBrutessh,
  hasFtpcrack,
  hasHttpworm,
  hasRelaysmtp,
  hasSqlinject,
} from './player';

import { BitBurner as NS } from 'bitburner';

const _hostname = Symbol('server:hostname');
const _ns = Symbol('ns');

export enum HackStatus {
  Hacked,
  NeedsLevel,
  NeedsPorts,
}

export class Server {
  public readonly [_hostname]: string;
  public readonly [_ns]: NS;

  constructor(ns: NS, hostname: string) {
    this[_hostname] = hostname;
    this[_ns] = ns;
    Object.freeze(this);
  }
}

export const getHostname = (server: Server) => server[_hostname];
export const getServerRam = (server: Server) => {
  const [total, used] = server[_ns].getServerRam(server[_hostname]);
  return { total, used };
};
export const hasRootAccess = (server: Server) =>
  server[_ns].hasRootAccess(server[_hostname]);
export const getAvailableMoney = (server: Server) =>
  server[_ns].getServerMoneyAvailable(server[_hostname]);
export const getMaxMoney = (server: Server) =>
  server[_ns].getServerMaxMoney(server[_hostname]);
export const getGrowth = (server: Server) =>
  server[_ns].getServerGrowth(server[_hostname]);
export const getSecurityLevel = (server: Server) =>
  server[_ns].getServerSecurityLevel(server[_hostname]);
export const getBaseSecurityLevel = (server: Server) =>
  server[_ns].getServerBaseSecurityLevel(server[_hostname]);
export const getMinSecurityLevel = (server: Server) =>
  server[_ns].getServerMinSecurityLevel(server[_hostname]);
export const getRequiredHackingLevel = (server: Server) =>
  server[_ns].getServerRequiredHackingLevel(server[_hostname]);
export const getRequiredPortCount = (server: Server) =>
  server[_ns].getServerNumPortsRequired(server[_hostname]);
export const fileExists = (server: Server, fileName: string) =>
  server[_ns].fileExists(fileName, server[_hostname]);

export const getHackStatus = (server: Server) => {
  if (hasRootAccess(server)) return HackStatus.Hacked;
  if (getRequiredHackingLevel(server) > getPlayerHackingLevel(server[_ns]))
    return HackStatus.NeedsLevel;
  let ports = getRequiredPortCount(server);

  if (hasBrutessh(server[_ns])) {
    server[_ns].brutessh(server[_hostname]);
    ports--;
  }

  if (hasFtpcrack(server[_ns])) {
    server[_ns].ftpcrack(server[_hostname]);
    ports--;
  }

  if (hasHttpworm(server[_ns])) {
    server[_ns].httpworm(server[_hostname]);
    ports--;
  }

  if (hasRelaysmtp(server[_ns])) {
    server[_ns].relaysmtp(server[_hostname]);
    ports--;
  }

  if (hasSqlinject(server[_ns])) {
    server[_ns].sqlinject(server[_hostname]);
    ports--;
  }

  if (ports <= 0) {
    server[_ns].nuke(server[_hostname]);
    if (!hasRootAccess(server)) return HackStatus.NeedsPorts;
    return HackStatus.Hacked;
  }

  return HackStatus.NeedsPorts;
};
