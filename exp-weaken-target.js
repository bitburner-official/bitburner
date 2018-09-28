const main = async (ns) => {
    const [host, endS] = ns.args;
    const end = parseInt(endS, 10);
    while (Date.now() < end) {
        await ns.weaken(host);
    }
};

export { main };
