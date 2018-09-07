import { BitBurner as NS } from 'bitburner';

export const getPlayerMoney = (ns: NS) => ns.getServerMoneyAvailable('home');
export const getPlayerHackingLevel = (ns: NS) => ns.getHackingLevel();
export const hasBrutessh = (ns: NS) => ns.fileExists('brutessh.exe', 'home');
export const hasFtpcrack = (ns: NS) => ns.fileExists('ftpcrack.exe', 'home');
export const hasRelaysmtp = (ns: NS) => ns.fileExists('relaysmtp.exe', 'home');
export const hasHttpworm = (ns: NS) => ns.fileExists('httpworm.exe', 'home');
export const hasSqlinject = (ns: NS) => ns.fileExists('sqlinject.exe', 'home');
