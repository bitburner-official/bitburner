const _update = Symbol('state:update');
const _reset = Symbol('state:reset');
const state = (ns, defaultState, owner = ns.getScriptName()) => {
    const name = owner + '.state.json.txt';
    const writeState = (state) => {
        const json = JSON.stringify(state, null, 2);
        ns.write(name, json, 'w');
    };
    const readState = () => {
        if (!ns.fileExists(name)) {
            writeState(defaultState);
        }
        let json = ns.read(name);
        if (!json || json.trim().length === 0) {
            writeState(defaultState);
            json = ns.read(name);
        }
        let data;
        try {
            data = JSON.parse(json);
        }
        catch (_a) {
            writeState(defaultState);
            data = JSON.parse(JSON.stringify(defaultState));
        }
        return data;
    };
    const updateState = (fn) => {
        const state = readState();
        const ret = fn(state);
        writeState(state);
        return ret;
    };
    const resetState = () => {
        writeState(defaultState);
    };
    const mkProxy = (basePath, base) => new Proxy(base, {
        get(_, property) {
            if (property === _update) {
                return updateState;
            }
            if (property === _reset) {
                return resetState;
            }
            const path = [...basePath, property];
            let data = readState();
            for (const part of path) {
                if (data && data.hasOwnProperty(part)) {
                    data = data[part];
                }
                else {
                    data = void 0;
                }
            }
            if (data === null ||
                typeof data === 'undefined' ||
                typeof data === 'number' ||
                typeof data === 'string' ||
                typeof data === 'boolean')
                return data;
            return mkProxy(path, Array.isArray(data) ? [] : {});
        },
        set(_, property, value) {
            if (typeof property === 'symbol') {
                return false;
            }
            const path = [...basePath];
            let data = readState();
            for (const part of path) {
                if (data.hasOwnProperty(part)) {
                    data = data[part];
                }
                else {
                    throw new Error(`Object has no property '${part}' (part of '${path.join('.')}')`);
                }
            }
            if (data && typeof data === 'object') {
                data[property] = value;
                return true;
            }
            return false;
        },
    });
    return mkProxy([], {});
};
const update = (updatable, fn) => updatable[_update](fn);

const getPlayerMoney = (ns) => ns.getServerMoneyAvailable('home');

const LEDGER_STATE_OWNER = 'ledger';
const _ns = Symbol('ns');
const _name = Symbol('investor:name');
const _conf = Symbol('investor:conf');
const _state = Symbol('investor:state');
const getState = (ns) => state(ns, {}, LEDGER_STATE_OWNER);
class Investor {
    constructor(ns, name, budget /* percentage (0,100] */) {
        const host = ns.getHostname();
        if (host !== 'home') {
            throw new Error(`Investor instances can only run on the home server.`);
        }
        this[_ns] = ns;
        this[_name] = name;
        this[_conf] = { budget };
        this[_state] = getState(ns);
        Object.freeze(this);
    }
}
const defaultEntry = () => ({
    totalInvested: 0,
    investments: {},
});
const incr = (n, m) => typeof n === 'undefined' ? m : n + m;
const getInvestments = (investor) => investor[_state][investor[_name]] || defaultEntry();
const getBudget = (investor, name = null) => {
    const investments = getInvestments(investor);
    const money = getPlayerMoney(investor[_ns]);
    const { budget } = investor[_conf];
    const totalInvested = Math.floor(investments.totalInvested);
    const totalAssets = totalInvested + money;
    const allowedUse = Math.floor((totalAssets * budget) / 100) - totalInvested;
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
    return update(investor[_state], ledger => {
        const investments = ledger[investor[_name]] || (ledger[investor[_name]] = defaultEntry());
        investments.totalInvested += used;
        investments.investments[name] = incr(investments.investments[name], used);
        return true;
    });
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

const formatters = new WeakMap();
const getFormatter = (v) => {
    if (v === null)
        return null;
    const formatter = formatters.get(v);
    return formatter || getFormatter(Object.getPrototypeOf(v));
};
const arg = (v) => {
    if (typeof v === 'undefined')
        return '<undefined>';
    if (v === null)
        return '<null>';
    const formatter = getFormatter(v);
    if (formatter)
        return formatter(v);
    if (typeof v.toLocaleString === 'function')
        return v.toLocaleString('en-us');
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
    ns.disableLog('ALL');
    const log = createLogger(ns);
    const investor = new Investor(ns, 'hacknet', 40);
    const nextAction = () => {
        const nodePrice = getNodePurchaseCost(ns);
        const actionsArr = [
            [
                {
                    price: nodePrice,
                    description: 'purchase new hacknet node',
                    exec: ns => {
                        const nodePrice = getNodePurchaseCost(ns);
                        if (purchaseNode(ns) === null)
                            return 0;
                        return nodePrice;
                    },
                },
            ],
            ...getNodes(ns).map((node) => {
                const actions = [];
                const levelCost = getNodeLevelCost(node);
                const ramCost = getNodeRamCost(node);
                const coreCost = getNodeCoreCost(node);
                if (levelCost !== null) {
                    actions.push({
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
                    });
                }
                if (ramCost !== null) {
                    actions.push({
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
                    });
                }
                if (coreCost !== null) {
                    actions.push({
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
                    });
                }
                return actions;
            }),
        ];
        const actions = [].concat(...actionsArr);
        return actions.reduce((left, right) => {
            if (left.price < right.price)
                return left;
            return right;
        });
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
                log `Need ${action.price - budget.moneyLeft} more money...`;
            }
            await ns.sleep(5000);
        }
    }
};

export { main };
