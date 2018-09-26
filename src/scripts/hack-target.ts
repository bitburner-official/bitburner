import serverFarmTool from '../utils/server-farm-tool';

export const main = serverFarmTool((ns, host) => ns.hack(host));
