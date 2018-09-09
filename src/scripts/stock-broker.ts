import {
  Investor,
  getBudget,
  getInvestment,
  releaseInvestment,
  tryInvest,
} from '../utils/investor';
import { BitBurner as NS, StockSymbol } from 'bitburner';

import { createLogger } from '../utils/print';
import { getPlayerMoney } from '../core/player';

const TRANSACTION_COST = 100_000;

type StockInfo = {
  readonly sym: StockSymbol;
  lastprice: number;
  sma10: Array<number>;
  sma40: Array<number>;
  rising: boolean;
  sma10sum: number;
  sma40sum: number;
};

const stocks: { [sym: string]: StockInfo } = {};

const invest = (
  investor: Investor,
  sym: StockSymbol,
  totalSymbols: number,
  buy: (budget: number) => number,
) => {
  const budget = getBudget(investor, sym);
  const maxInvestment = Math.floor(budget.allowedUse / totalSymbols);
  const left = Math.min(maxInvestment - budget.invested, budget.totalMoney);
  tryInvest(investor, sym, left, () => buy(left));
};

const run = (
  ns: NS,
  sym: StockSymbol,
  symbols: ReadonlyArray<StockSymbol>,
  iter: number,
  investor: Investor,
) => {
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
      const temp = info.sma10.shift()!;
      info.sma10sum -= temp;
    }

    // update sma40
    info.sma40.push(price);
    info.sma40sum += price;
    if (info.sma40.length > 40) {
      const temp = info.sma40.shift()!;
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
            log`Buy ${volume} shares`;
            const purchasePrice = ns.buyStock(info.sym, volume);
            return purchasePrice * volume + TRANSACTION_COST;
          } else {
            log`Only want to buy ${volume} shares, skipping...`;
            return 0;
          }
        });
      } else if (!info.rising && (oldRising || iter === 45)) {
        // was rising, now falling, close long and open short
        releaseInvestment(investor, info.sym);
        ns.sellStock(info.sym, Number.MAX_SAFE_INTEGER);

        invest(investor, sym, symbols.length, budget => {
          const volume = (budget - TRANSACTION_COST) / price;
          if (volume > 100) {
            log`Short ${volume} shares`;
            const purchasePrice = ns.shortStock(info.sym, volume);
            return purchasePrice * volume + TRANSACTION_COST;
          } else {
            log`Only want to short ${volume} shares, skipping...`;
            return 0;
          }
        });
      }
    }
  }
};

export const main = async (ns: NS) => {
  // get the name of this node
  ns.disableLog('getServerMoneyAvailable');
  ns.disableLog('sleep');
  const investor = new Investor(ns, 'stock', 80);
  const daemonHost = ns.getHostname();
  const log = createLogger(ns);

  if (daemonHost !== 'home') {
    throw new Error(`Daemon is only intended to run on 'home' host.`);
  }

  const symbols: ReadonlyArray<StockSymbol> = Object.freeze([
    ...ns.args,
  ] as Array<StockSymbol>);

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
