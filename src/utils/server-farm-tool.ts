import { Host, BitBurner as NS } from 'bitburner';

const serverFarmTool = (fn: (ns: NS, host: Host) => Promise<any>) => {
  // hide the async function
  const tool = async (ns: NS) => {
    const [host] = ns.args;
    await fn(ns, host);
  };

  return (ns: NS) => tool(ns);
};

export default serverFarmTool;
