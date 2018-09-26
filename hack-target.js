const serverFarmTool = (fn) => {
    // hide the async function
    const tool = async (ns) => {
        const [host] = ns.args;
        await fn(ns, host);
    };
    return (ns) => tool(ns);
};

const main = serverFarmTool((ns, host) => ns.hack(host));

export { main };
