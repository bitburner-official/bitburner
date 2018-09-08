import { BitBurner as NS } from 'bitburner';

export const main = async (ns: NS) => {
  const [host, maxSecStr, minMoneyStr] = ns.args;
  if (!host || !maxSecStr || !minMoneyStr)
    throw new Error(`Requires 3 arguments`);

  const maxSec = parseInt(maxSecStr, 10),
    minMoney = parseInt(minMoneyStr, 10);

  while (true) {
    const sec = ns.getServerSecurityLevel(host);
    const money = ns.getServerMoneyAvailable(host);
    if (sec > maxSec) {
      await ns.weaken(host);
    } else if (money < minMoney) {
      await ns.grow(host);
    } else {
      await ns.hack(host);
    }
  }
};
