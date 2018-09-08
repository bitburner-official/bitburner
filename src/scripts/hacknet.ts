import { Investor, getBudget, tryInvest } from '../utils/investor';
import {
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

type Action = {
  readonly description: string;
  readonly price: number;
  readonly exec: (ns: NS) => number;
};

export const main = async (ns: NS) => {
  ns.disableLog('getServerMoneyAvailable');
  ns.disableLog('sleep');
  const log = createLogger(ns);
  const investor = new Investor(ns, 'hacknet', 100);

  const nextAction = () => {
    const nodePrice = getNodePurchaseCost(ns);
    let action: Action = {
      price: nodePrice,
      description: 'purchase new hacknet node',
      exec: ns => {
        const nodePrice = getNodePurchaseCost(ns);
        if (purchaseNode(ns) === null) return 0;
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
            if (levelCost === null) return 0;
            if (upgradeNodeLevel(node)) return levelCost;
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
            if (ramCost === null) return 0;
            if (upgradeNodeRam(node)) return ramCost;
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
            if (coreCost === null) return 0;
            if (upgradeNodeCores(node)) return coreCost;
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
        log`Want to ${action.description}, but does not have the budget for ${
          action.price
        }. Money: ${budget.totalMoney}, invested: ${
          budget.invested
        }.  Waiting...`;
      } else {
        const budget = getBudget(investor);
        log`Need ${budget.moneyLeft - action.price} more money...`;
      }

      await ns.sleep(5000);
    }
  }
};
