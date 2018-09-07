import { BitBurner as NS } from 'bitburner';

export const main = async (ns: NS) => {
  const [host] = ns.args;
  while (true) {
    await ns.weaken(host);
  }
};
