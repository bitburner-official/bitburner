import {
  HacknetNode,
  getNodeCoreCost,
  getNodeLevelCost,
  getNodePurchaseCost,
  getNodeRamCost,
  getNodes,
  purchaseNode,
  upgradeNodeCores,
  upgradeNodeLevel,
  upgradeNodeRam,
} from '../core/hacknet';

import { BitBurner as NS } from 'bitburner';
import { createLogger } from '../utils/print';
import { getPlayerMoney } from '../core/player';

type PurchaseAction = { readonly type: 'purchase'; readonly price: number };
type LevelAction = {
  readonly type: 'level';
  readonly price: number;
  readonly node: HacknetNode;
};
type RamAction = {
  readonly type: 'ram';
  readonly price: number;
  readonly node: HacknetNode;
};
type CoreAction = {
  readonly type: 'core';
  readonly price: number;
  readonly node: HacknetNode;
};
type Action = PurchaseAction | LevelAction | RamAction | CoreAction;

export const main = async (ns: NS) => {
  ns.disableLog('getServerMoneyAvailable');
  ns.disableLog('sleep');
  const log = createLogger(ns);

  const nextAction = () => {
    const nodePrice = getNodePurchaseCost(ns);
    let action: Action = { type: 'purchase', price: nodePrice };

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
  const allowPurchase = (
    cost: number,
    prevHighestPrice: number,
    money: number,
  ) => {
    if (cost + prevHighestPrice * (allowParts - 1) > money) return false;
    if (cost * allowParts > money) return false;
    return true;
  };

  let prevHighestPrice: number = 0;
  while (true) {
    const action = nextAction();

    let first = true;
    while (!allowPurchase(action.price, prevHighestPrice, getPlayerMoney(ns))) {
      if (first) {
        first = false;
        log`Price ${action.price} is too high, waiting for more money.`;
      }

      await ns.sleep(2000);
    }

    switch (action.type) {
      case 'purchase':
        log`Purchacing new node`;
        purchaseNode(ns);
        break;

      case 'level':
        log`Upgrading level for node ${action.node}`;
        upgradeNodeLevel(action.node);
        break;

      case 'ram':
        log`Upgrading ram for node ${action.node}`;
        upgradeNodeRam(action.node);
        break;

      case 'core':
        log`Upgrading cores for node ${action.node}`;
        upgradeNodeCores(action.node);
        break;

      default:
        throw new Error(`Invalid action type: ${(action as any).type}`);
    }

    prevHighestPrice = Math.max(prevHighestPrice, action.price);
  }
};
