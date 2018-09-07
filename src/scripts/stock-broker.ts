import { BitBurner as NS, StockSymbol } from 'bitburner';

import { createLogger } from '../utils/print';
import { getPlayerMoney } from '../core/player';

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

const getBuyValue = (ns: NS, symbols: ReadonlyArray<StockSymbol>) => {
  let positions = 0;

  // how many of the stocks do we currently have a position open?
  for (const sym of symbols) {
    const pos = ns.getStockPosition(sym);
    if (pos[0] + pos[2] !== 0) {
      positions++;
    }
  }

  // allow opening of a position using of a proportion of available cash
  // depending on number of already open positions
  const buyValue = getPlayerMoney(ns) / (symbols.length + 1 - positions);
  return buyValue - 100000;
};

const run = (
  ns: NS,
  sym: StockSymbol,
  symbols: ReadonlyArray<StockSymbol>,
  iter: number,
) => {
  const log = createLogger(ns, `[${sym}] `);
  const info = stocks[sym];
  const price = ns.getStockPrice(sym);
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
        ns.sellShort(info.sym, Number.MAX_SAFE_INTEGER);
        const volume = Math.floor(getBuyValue(ns, symbols) / price);
        if (volume > 100) {
          log`Buy ${volume} shares`;
          ns.buyStock(info.sym, volume);
        } else {
          log`Only want to buy ${volume} shares, skipping...`;
        }
      } else if (!info.rising && (oldRising || iter === 45)) {
        // was rising, now falling, close long and open short
        ns.sellStock(info.sym, Number.MAX_SAFE_INTEGER);
        const volume = Math.floor(getBuyValue(ns, symbols) / price);
        if (volume > 100) {
          log`Short ${volume} shares`;
          ns.shortStock(info.sym, volume);
        } else {
          log`Only want to short ${volume} shares, skipping...`;
        }
      }
    }
  }
};

export const main = async (ns: NS) => {
  // get the name of this node
  ns.disableLog('sleep');
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

      log`looping, itter: ${iter}`;
      for (const sym of symbols) {
        run(ns, sym, symbols, iter);
      }
    }

    await ns.sleep(2500);
  }
};
