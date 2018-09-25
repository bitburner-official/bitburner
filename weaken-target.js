const delayedSingle = (fn) => {
    // hide the async function
    const delayed = async (ns) => {
        const [host, time] = ns.args;
        await ns.sleep(parseInt(time, 10) - Date.now());
        await fn(ns, host);
    };
    return (ns) => delayed(ns);
};

const main = delayedSingle((ns, host) => ns.weaken(host));

export { main };
