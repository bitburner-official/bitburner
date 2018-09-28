import { Host, BitBurner as NS } from 'bitburner';

export const main = async (ns: NS) => {
  const [host, endS] = ns.args;
  const end = parseInt(endS, 10);
  while (Date.now() < end) {
    await ns.weaken(host);
  }
};
