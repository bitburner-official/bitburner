import { Host, BitBurner as NS } from 'bitburner';

const delayedSingle = (fn: (ns: NS, host: Host) => Promise<any>) => async (
  ns: NS,
) => {
  const [host, time] = ns.args;
  await ns.sleep(parseInt(time, 10) - Date.now());
  await fn(ns, host);
};

export default delayedSingle;
