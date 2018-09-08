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
    const moneyLeft = Math.floor(allowedUse - totalInvested);
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
    const used = action(investor[_ns]);
    if (used <= 0)
        return;
    investments.totalInvested += used;
    investments.investments[name] = incr(investments.investments[name], used);
    updateLedger(investor, investments);
    return true;
};
const releaseInvestment = (investor, name) => {
    const investments = getInvestments(investor);
    const currentInvestment = investments.investments[name];
    if (typeof currentInvestment === 'undefined') {
        return;
    }
    investments.totalInvested -= currentInvestment;
    delete investments.investments[name];
    updateLedger(investor, investments);
};

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

const TRANSACTION_COST = 100000;
const stocks = {};
const invest = (investor, sym, totalSymbols, buy) => {
    const budget = getBudget(investor, sym);
    const maxInvestment = Math.floor(budget.allowedUse / totalSymbols);
    const left = maxInvestment - budget.invested;
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
    ns.disableLog('sleep');
    const investor = new Investor(ns, 'stock', 60);
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
