import state, { Updatable, reset, update } from './state';

import { BitBurner as NS } from 'bitburner';
import { getPlayerMoney } from '../core/player';

const LEDGER_STATE_OWNER = 'ledger';
const _ns = Symbol('ns');
const _name = Symbol('investor:name');
const _conf = Symbol('investor:conf');
const _state = Symbol('investor:state');

type LedgerEntry = {
  totalInvested: number /* total investments made */;
  investments: {
    [name: string]: number | void /* money in specific investment */;
  };
};

type Ledger = {
  [investorName: string]: LedgerEntry | void;
};

type InvestorConfig = {
  readonly budget: number /* percentage (0,100] */;
};

type Budget = {
  readonly totalMoney: number;
  readonly allowedPercentag: number;
  readonly invested: number;
  readonly moneyLeft: number;
  readonly allowedUse: number;
};

const getState = (ns: NS): Updatable<Ledger> =>
  state(ns, {}, LEDGER_STATE_OWNER);

export class Investor {
  public readonly [_ns]: NS;
  public readonly [_name]: string;
  public readonly [_conf]: InvestorConfig;
  public readonly [_state]: Updatable<Ledger>;

  constructor(ns: NS, name: string, budget: number /* percentage (0,100] */) {
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

const defaultEntry = (): LedgerEntry => ({
  totalInvested: 0,
  investments: {},
});

const incr = (n: number | void, m: number) =>
  typeof n === 'undefined' ? m : n + m;

const getInvestments = (investor: Investor): LedgerEntry =>
  investor[_state][investor[_name]] || defaultEntry();

export const getBudget = (
  investor: Investor,
  name: string | null = null,
): Budget => {
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
    invested:
      name === null
        ? totalInvested
        : Math.floor(investments.investments[name] || 0),
    allowedUse,
    moneyLeft,
  };
};

export const getInvestment = (investor: Investor, name: string) =>
  getInvestments(investor).investments[name] || 0;

export const tryInvest = (
  investor: Investor,
  name: string,
  price: number,
  action: (ns: NS) => number,
) => {
  const investments = getInvestments(investor);
  const money = getPlayerMoney(investor[_ns]);
  const { budget } = investor[_conf];
  const totalAllowedUse = (money * budget) / 100;
  const allowedUse = totalAllowedUse - investments.totalInvested;
  if (allowedUse < price) return false;
  if (price > money) return false;

  const used = action(investor[_ns]);
  if (used <= 0) return false;
  return update(investor[_state], ledger => {
    const investments =
      ledger[investor[_name]] || (ledger[investor[_name]] = defaultEntry());
    investments.totalInvested += used;
    investments.investments[name] = incr(investments.investments[name], used);
    return true;
  });
};

export const releaseInvestment = (investor: Investor, name: string) => {
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

export const resetInvestments = (ns: NS) => reset(getState(ns));
