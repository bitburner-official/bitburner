import { Host, BitBurner as NS, Script, StockSymbol } from 'bitburner';

import { getPlayerMoney } from '../core/player';

const LEDGER_FILE = 'ledger.json';
const _ns = Symbol('ns');
const _name = Symbol('investor:name');
const _conf = Symbol('investor:conf');

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
};

export class Investor {
  public readonly [_ns]: NS;
  public readonly [_name]: string;
  public readonly [_conf]: InvestorConfig;

  constructor(ns: NS, name: string, budget: number /* percentage (0,100] */) {
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

const incr = (n: number | void, m: number) =>
  typeof n === 'undefined' ? m : n + m;

const readLedger = (investor: Investor): Ledger => {
  const text = investor[_ns].read(LEDGER_FILE);
  if (text.trim().length === 0) {
    return {};
  }

  return JSON.parse(text);
};

const getInvestments = (investor: Investor): LedgerEntry =>
  readLedger(investor)[investor[_name]] || {
    totalInvested: 0,
    investments: {},
  };

const updateLedger = (investor: Investor, investments: LedgerEntry) => {
  const ledger = readLedger(investor);
  ledger[investor[_name]] = investments;
  investor[_ns].write(LEDGER_FILE, JSON.stringify(ledger), 'w');
};

export const getBudget = (investor: Investor): Budget => {
  const investments = getInvestments(investor);
  const money = getPlayerMoney(investor[_ns]);
  const { budget } = investor[_conf];
  const allowedUse = (money * budget) / 100;
  const moneyLeft = Math.floor(allowedUse - investments.totalInvested);

  return {
    totalMoney: money,
    allowedPercentag: budget,
    invested: Math.floor(investments.totalInvested),
    moneyLeft,
  };
};

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

  const used = action(investor[_ns]);
  investments.totalInvested += used;
  investments.investments[name] = incr(investments.investments[name], used);
  updateLedger(investor, investments);
  return true;
};

export const releaseInvestment = (investor: Investor, name: string) => {
  const investments = getInvestments(investor);
  const currentInvestment = investments.investments[name];
  if (typeof currentInvestment === 'undefined') {
    return;
  }

  investments.totalInvested -= currentInvestment;
  delete investments.investments[name];
  updateLedger(investor, investments);
};
