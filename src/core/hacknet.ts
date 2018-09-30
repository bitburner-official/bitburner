import { BitBurner as NS } from 'bitburner';

const _ns = Symbol('ns');
const _index = Symbol('node:index');

export class HacknetNode {
  public readonly [_ns]: NS;
  public readonly [_index]: number;

  constructor(ns: NS, index: number) {
    this[_ns] = ns;
    this[_index] = index;
    Object.freeze(this);
  }

  toString(): string {
    return this[_ns].hacknet.getNodeStats(this[_index]).name;
  }

  [Symbol.toStringTag]() {
    return 'HacknetNode';
  }
}

export const getNodes = (ns: NS) => {
  const ret: HacknetNode[] = [];
  for (let i = 0, l = ns.hacknet.numNodes(); i < l; i++) {
    ret[i] = new HacknetNode(ns, i);
  }

  return ret;
};

export const getNodePurchaseCost = (ns: NS) => ns.hacknet.getPurchaseNodeCost();

export const purchaseNode = (ns: NS) => {
  const index = ns.hacknet.purchaseNode();

  if (index === -1) {
    return null;
  }

  return new HacknetNode(ns, index);
};

export const getNodeIndex = (node: HacknetNode) => node[_index];
export const getNodeStats = (node: HacknetNode) =>
  node[_ns].hacknet.getNodeStats(node[_index]);
export const getNodeName = (node: HacknetNode) => getNodeStats(node).name;
export const getNodeLevel = (node: HacknetNode) => getNodeStats(node).level;
export const getNodeRam = (node: HacknetNode) => getNodeStats(node).ram;
export const getNodeCores = (node: HacknetNode) => getNodeStats(node).cores;
export const getNodeProduction = (node: HacknetNode) =>
  getNodeStats(node).production;
export const getNodeTimeOnline = (node: HacknetNode) =>
  getNodeStats(node).timeOnline;
export const getNodeTotalProduction = (node: HacknetNode) =>
  getNodeStats(node).totalProduction;
export const isNodeMaxLevel = (node: HacknetNode) => getNodeLevel(node) >= 200;
export const isNodeMaxRam = (node: HacknetNode) => getNodeRam(node) >= 64;
export const isNodeMaxCores = (node: HacknetNode) => getNodeCores(node) >= 16;
export const isNodeFullyUpgraded = (node: HacknetNode) => {
  const { level, ram, cores } = getNodeStats(node);
  return level >= 200 && ram >= 64 && cores >= 16;
};
export const getNodeLevelCost = (node: HacknetNode) =>
  isNodeMaxLevel(node)
    ? null
    : node[_ns].hacknet.getLevelUpgradeCost(node[_index], 1);
export const getNodeRamCost = (node: HacknetNode) =>
  isNodeMaxRam(node)
    ? null
    : node[_ns].hacknet.getRamUpgradeCost(node[_index], 1);
export const getNodeCoreCost = (node: HacknetNode) =>
  isNodeMaxCores(node)
    ? null
    : node[_ns].hacknet.getCoreUpgradeCost(node[_index], 1);
export const upgradeNodeLevel = (node: HacknetNode) =>
  node[_ns].hacknet.upgradeLevel(node[_index], 1);
export const upgradeNodeRam = (node: HacknetNode) =>
  node[_ns].hacknet.upgradeRam(node[_index], 1);
export const upgradeNodeCores = (node: HacknetNode) =>
  node[_ns].hacknet.upgradeCore(node[_index], 1);
