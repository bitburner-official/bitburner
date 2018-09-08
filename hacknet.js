const getPlayerMoney = (ns) => ns.getServerMoneyAvailable('home');

const LEDGER_FILE = 'ledger.json';
const _ns = Symbol('ns');
const _name = Symbol('investor:name');
const _conf = Symbol('investor:conf');
class Investor {
    constructor(ns, name, budget /* percentage (0,100] */) {
        const host = ns.getHostname();
        if (host !== 'home') {
            throw new Error(`Investor instances can only run on the home server.`);
        }
        this[_ns] = ns;
        this[_name] = name;
        this[_conf] = { budget };
        Object.freeze(this);
    }
}
const incr = (n, m) => typeof n === 'undefined' ? m : n + m;
const readLedger = (investor) => {
    const text = investor[_ns].read(LEDGER_FILE);
    if (text.trim().length === 0) {
        return {};
    }
    return JSON.parse(text);
};
const getInvestments = (investor) => readLedger(investor)[investor[_name]] || {
    totalInvested: 0,
    investments: {},
};
const updateLedger = (investor, investments) => {
    const ledger = readLedger(investor);
    ledger[investor[_name]] = investments;
    investor[_ns].write(LEDGER_FILE, JSON.stringify(ledger, null, 2), 'w');
};
const getBudget = (investor, name = null) => {
    const investments = getInvestments(investor);
    const money = getPlayerMoney(investor[_ns]);
    const { budget } = investor[_conf];
    const allowedUse = Math.floor((money * budget) / 100);
    const totalInvested = Math.floor(investments.totalInvested);
    const moneyLeft = Math.min(Math.floor(allowedUse - totalInvested), money);
    return {
        totalMoney: money,
        allowedPercentag: budget,
        invested: name === null
            ? totalInvested
            : Math.floor(investments.investments[name] || 0),
        allowedUse,
        moneyLeft,
    };
};
const tryInvest = (investor, name, price, action) => {
    const investments = getInvestments(investor);
    const money = getPlayerMoney(investor[_ns]);
    const { budget } = investor[_conf];
    const totalAllowedUse = (money * budget) / 100;
    const allowedUse = totalAllowedUse - investments.totalInvested;
    if (allowedUse < price)
        return false;
    if (price > money)
        return false;
    const used = action(investor[_ns]);
    if (used <= 0)
        return false;
    investments.totalInvested += used;
    investments.investments[name] = incr(investments.investments[name], used);
    updateLedger(investor, investments);
    return true;
};

const _ns$1 = Symbol('ns');
const _index = Symbol('node:index');
class HacknetNode {
    constructor(ns, index) {
        this[_ns$1] = ns;
        this[_index] = index;
        Object.freeze(this);
    }
    toString() {
        return this[_ns$1].hacknet.getNodeStats(this[_index]).name;
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
const getNodeStats = (node) => node[_ns$1].hacknet.getNodeStats(node[_index]);
const getNodeLevel = (node) => getNodeStats(node).level;
const getNodeRam = (node) => getNodeStats(node).ram;
const getNodeCores = (node) => getNodeStats(node).cores;
const isNodeMaxLevel = (node) => getNodeLevel(node) >= 200;
const isNodeMaxRam = (node) => getNodeRam(node) >= 64;
const isNodeMaxCores = (node) => getNodeCores(node) >= 16;
const getNodeLevelCost = (node) => isNodeMaxLevel(node)
    ? null
    : node[_ns$1].hacknet.getLevelUpgradeCost(node[_index], 1);
const getNodeRamCost = (node) => isNodeMaxRam(node)
    ? null
    : node[_ns$1].hacknet.getRamUpgradeCost(node[_index], 1);
const getNodeCoreCost = (node) => isNodeMaxCores(node)
    ? null
    : node[_ns$1].hacknet.getRamUpgradeCost(node[_index], 1);
const upgradeNodeLevel = (node) => node[_ns$1].hacknet.upgradeLevel(node[_index], 1);
const upgradeNodeRam = (node) => node[_ns$1].hacknet.upgradeRam(node[_index], 1);
const upgradeNodeCores = (node) => node[_ns$1].hacknet.upgradeCore(node[_index], 1);

const arg = (v) => {
    if (typeof v === 'undefined')
        return '<undefined>';
    if (v === null)
        return '<null>';
    if (typeof v.toLocaleString === 'function')
        return v.toLocaleString();
    return String(v);
};
const prettifyString = (literals, ...placeholders) => {
    let result = '';
    for (let i = 0; i < placeholders.length; i++) {
        result += literals[i];
        result += arg(placeholders[i]);
    }
    // add the last literal
    result += literals[literals.length - 1];
    return result;
};
const maybeStr = (prefix) => typeof prefix === 'string' ? prefix : '';
const createLogger = (ns, prefix) => (literals, ...placeholders) => ns.print(maybeStr(prefix) + prettifyString(literals, ...placeholders));

const main = async (ns) => {
    ns.disableLog('getServerMoneyAvailable');
    ns.disableLog('sleep');
    const log = createLogger(ns);
    const investor = new Investor(ns, 'hacknet', 100);
    const nextAction = () => {
        const nodePrice = getNodePurchaseCost(ns);
        let action = {
            price: nodePrice,
            description: 'purchase new hacknet node',
            exec: ns => {
                const nodePrice = getNodePurchaseCost(ns);
                if (purchaseNode(ns) === null)
                    return 0;
                return nodePrice;
            },
        };
        for (let node of getNodes(ns)) {
            const levelCost = getNodeLevelCost(node);
            const ramCost = getNodeRamCost(node);
            const coreCost = getNodeCoreCost(node);
            if (levelCost !== null && levelCost < action.price) {
                action = {
                    price: levelCost,
                    description: `upgrade level of node ${node}`,
                    exec: ns => {
                        const levelCost = getNodeLevelCost(node);
                        if (levelCost === null)
                            return 0;
                        if (upgradeNodeLevel(node))
                            return levelCost;
                        return 0;
                    },
                };
            }
            if (ramCost !== null && ramCost < action.price) {
                action = {
                    price: ramCost,
                    description: `upgrade ram of node ${node}`,
                    exec: ns => {
                        const ramCost = getNodeRamCost(node);
                        if (ramCost === null)
                            return 0;
                        if (upgradeNodeRam(node))
                            return ramCost;
                        return 0;
                    },
                };
            }
            if (coreCost !== null && coreCost < action.price) {
                action = {
                    price: coreCost,
                    description: `upgrade cores of node ${node}`,
                    exec: ns => {
                        const coreCost = getNodeCoreCost(node);
                        if (coreCost === null)
                            return 0;
                        if (upgradeNodeCores(node))
                            return coreCost;
                        return 0;
                    },
                };
            }
        }
        return action;
    };
    while (true) {
        const action = nextAction();
        let first = true;
        while (!tryInvest(investor, 'hacknet', action.price, action.exec)) {
            if (first) {
                first = false;
                const budget = getBudget(investor);
                log `Want to ${action.description}, but does not have the budget for ${action.price}. Money: ${budget.totalMoney}, invested: ${budget.invested}.  Waiting...`;
            }
            else {
                const budget = getBudget(investor);
                log `Need ${budget.moneyLeft - action.price} more money...`;
            }
            await ns.sleep(5000);
        }
    }
};

export { main };
