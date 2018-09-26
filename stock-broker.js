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
const getInvestment = (investor, name) => getInvestments(investor).investments[name] || 0;
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
const releaseInvestment = (investor, name) => {
    const investments = getInvestments(investor);
    const currentInvestment = investments.investments[name];
    if (typeof currentInvestment === 'undefined') {
        return;
    }
    return update(investor[_state], ledger => {
        const investments = ledger[investor[_name]] || defaultEntry();
        investments.totalInvested -= currentInvestment;
        delete investments.investments[name];
    });
};

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

const TRANSACTION_COST = 100000;
const stocks = {};
const invest = (investor, sym, totalSymbols, buy) => {
    const budget = getBudget(investor, sym);
    const maxInvestment = Math.floor(budget.allowedUse / totalSymbols);
    const left = Math.min(maxInvestment - budget.invested, budget.totalMoney);
    tryInvest(investor, sym, left, () => buy(left));
};
const run = (ns, sym, symbols, iter, investor) => {
    const log = createLogger(ns, `[${sym}] `);
    const info = stocks[sym];
    const price = ns.getStockPrice(sym);
    const investment = getInvestment(investor, sym);
    if (price !== info.lastprice) {
        // update lastprice
        info.lastprice = price;
        // note old value
        const oldRising = info.rising;
        // update sma10
        info.sma10.push(price);
        info.sma10sum += price;
        if (info.sma10.length > 10) {
            const temp = info.sma10.shift();
            info.sma10sum -= temp;
        }
        // update sma40
        info.sma40.push(price);
        info.sma40sum += price;
        if (info.sma40.length > 40) {
            const temp = info.sma40.shift();
            info.sma40sum -= temp;
        }
        // update rising once we get warmed up
        if (iter > 43) {
            const avg10 = info.sma10sum / 10;
            const avg40 = info.sma40sum / 40;
            info.rising = avg10 > avg40;
        }
        // trade if apt
        if (iter >= 45) {
            if (info.rising && (!oldRising || iter === 45)) {
                // was falling, now rising, close short and open long
                releaseInvestment(investor, info.sym);
                ns.sellShort(info.sym, Number.MAX_SAFE_INTEGER);
                invest(investor, sym, symbols.length, budget => {
                    const volume = (budget - TRANSACTION_COST) / price;
                    if (volume > 100) {
                        log `Buy ${volume} shares`;
                        const purchasePrice = ns.buyStock(info.sym, volume);
                        return purchasePrice * volume + TRANSACTION_COST;
                    }
                    else {
                        log `Only want to buy ${volume} shares, skipping...`;
                        return 0;
                    }
                });
            }
            else if (!info.rising && (oldRising || iter === 45)) {
                // was rising, now falling, close long and open short
                releaseInvestment(investor, info.sym);
                ns.sellStock(info.sym, Number.MAX_SAFE_INTEGER);
                invest(investor, sym, symbols.length, budget => {
                    const volume = (budget - TRANSACTION_COST) / price;
                    if (volume > 100) {
                        log `Short ${volume} shares`;
                        const purchasePrice = ns.shortStock(info.sym, volume);
                        return purchasePrice * volume + TRANSACTION_COST;
                    }
                    else {
                        log `Only want to short ${volume} shares, skipping...`;
                        return 0;
                    }
                });
            }
        }
    }
};
const main = async (ns) => {
    // get the name of this node
    ns.disableLog('getServerMoneyAvailable');
    ns.disableLog('sleep');
    const investor = new Investor(ns, 'stock', 80);
    const daemonHost = ns.getHostname();
    if (daemonHost !== 'home') {
        throw new Error(`Daemon is only intended to run on 'home' host.`);
    }
    const symbols = Object.freeze([
        ...ns.args,
    ]);
    for (const sym of symbols) {
        stocks[sym] = {
            sym,
            lastprice: 0,
            sma10: [],
            sma40: [],
            rising: true,
            sma10sum: 0,
            sma40sum: 0,
        };
    }
    let iter = 0;
    let lastprice = ns.getStockPrice(symbols[0]);
    while (true) {
        let price = ns.getStockPrice(symbols[0]);
        if (price !== lastprice) {
            lastprice = price;
            iter++;
            // log`looping, itter: ${iter}`;
            for (const sym of symbols) {
                run(ns, sym, symbols, iter, investor);
            }
        }
        await ns.sleep(2500);
    }
};

export { main };
