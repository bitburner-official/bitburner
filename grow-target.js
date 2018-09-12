const delayedSingle = (fn) => async (ns) => {
    const [host, time] = ns.args;
    await ns.sleep(parseInt(time, 10) - Date.now());
    await fn(ns, host);
};

const main = delayedSingle((ns, host) => ns.grow(host));

export { main };
