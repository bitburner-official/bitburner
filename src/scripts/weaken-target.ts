import delayedSingle from '../utils/delayed-single';

export const main = delayedSingle((ns, host) => ns.weaken(host));
