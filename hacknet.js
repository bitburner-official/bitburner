import { g as createLogger, i as getPlayerMoney } from './chunk.06fc0bd6.js';

const _ns = Symbol('ns');
const _index = Symbol('node:index');
class HacknetNode {
    constructor(ns, index) {
        this[_ns] = ns;
        this[_index] = index;
        Object.freeze(this);
    }
    toString() {
        return this[_ns].hacknet.getNodeStats(this[_index]).name;
    }
    [Symbol.toStringTag]() {
        return 'HacknetNode';
    }
}
const getNodes = (ns) => {
    const ret = [];
    for (let i = 0, l = ns.hacknet.numNodes(); i < l; i++) {
        ret[i] = new HacknetNode(ns, i);
    }
    return ret;
};
const getNodePurchaseCost = (ns) => ns.hacknet.getPurchaseNodeCost();
const purchaseNode = (ns) => {
    const index = ns.hacknet.purchaseNode();
    if (index === -1) {
        return null;
    }
    return new HacknetNode(ns, index);
};
const getNodeStats = (node) => node[_ns].hacknet.getNodeStats(node[_index]);
const getNodeLevel = (node) => getNodeStats(node).level;
const getNodeRam = (node) => getNodeStats(node).ram;
const getNodeCores = (node) => getNodeStats(node).cores;
const isNodeMaxLevel = (node) => getNodeLevel(node) >= 200;
const isNodeMaxRam = (node) => getNodeRam(node) >= 64;
const isNodeMaxCores = (node) => getNodeCores(node) >= 16;
const getNodeLevelCost = (node) => isNodeMaxLevel(node)
    ? null
    : node[_ns].hacknet.getLevelUpgradeCost(node[_index], 1);
const getNodeRamCost = (node) => isNodeMaxRam(node)
    ? null
    : node[_ns].hacknet.getRamUpgradeCost(node[_index], 1);
const getNodeCoreCost = (node) => isNodeMaxCores(node)
    ? null
    : node[_ns].hacknet.getRamUpgradeCost(node[_index], 1);
const upgradeNodeLevel = (node) => node[_ns].hacknet.upgradeLevel(node[_index], 1);
const upgradeNodeRam = (node) => node[_ns].hacknet.upgradeRam(node[_index], 1);
const upgradeNodeCores = (node) => node[_ns].hacknet.upgradeCore(node[_index], 1);

const main = async (ns) => {
    ns.disableLog('getServerMoneyAvailable');
    ns.disableLog('sleep');
    const log = createLogger(ns);
    const nextAction = () => {
        const nodePrice = getNodePurchaseCost(ns);
        let action = { type: 'purchase', price: nodePrice };
        for (let node of getNodes(ns)) {
            const levelCost = getNodeLevelCost(node);
            const ramCost = getNodeRamCost(node);
            const coreCost = getNodeCoreCost(node);
            if (levelCost !== null && levelCost < action.price) {
                action = {
                    type: 'level',
                    price: levelCost,
                    node,
                };
            }
            if (ramCost !== null && ramCost < action.price) {
                action = {
                    type: 'ram',
                    price: ramCost,
                    node,
                };
            }
            if (coreCost !== null && coreCost < action.price) {
                action = {
                    type: 'core',
                    price: coreCost,
                    node,
                };
            }
        }
        return action;
    };
    const allowParts = 3;
    const allowPurchase = (cost, prevHighestPrice, money) => {
        if (cost + prevHighestPrice * (allowParts - 1) > money)
            return false;
        if (cost * allowParts > money)
            return false;
        return true;
    };
    let prevHighestPrice = 0;
    while (true) {
        const action = nextAction();
        let first = true;
        while (!allowPurchase(action.price, prevHighestPrice, getPlayerMoney(ns))) {
            if (first) {
                first = false;
                log `Price ${action.price} is too high, waiting for more money.`;
            }
            await ns.sleep(2000);
        }
        switch (action.type) {
            case 'purchase':
                log `Purchacing new node`;
                purchaseNode(ns);
                break;
            case 'level':
                log `Upgrading level for node ${action.node}`;
                upgradeNodeLevel(action.node);
                break;
            case 'ram':
                log `Upgrading ram for node ${action.node}`;
                upgradeNodeRam(action.node);
                break;
            case 'core':
                log `Upgrading cores for node ${action.node}`;
                upgradeNodeCores(action.node);
                break;
            default:
                throw new Error(`Invalid action type: ${action.type}`);
        }
        // Safety messure
        await ns.sleep(200);
        prevHighestPrice = Math.max(prevHighestPrice, action.price);
    }
};

export { main };
