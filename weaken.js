const main = async (ns) => {
    const [host] = ns.args;
    while (true) {
        await ns.weaken(host);
    }
};

export { main };
