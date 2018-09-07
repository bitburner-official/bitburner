declare module 'bitburner' {
  export type Host = string;
  export type Script = string;
  export type StockSymbol =
    | 'ECP'
    | 'MGCP'
    | 'BLD'
    | 'CLRK'
    | 'OMTK'
    | 'FSIG'
    | 'KGI'
    | 'FLCM'
    | 'STM'
    | 'DCOMM'
    | 'HLS'
    | 'VITA'
    | 'ICRS'
    | 'UNV'
    | 'AERO'
    | 'OMN'
    | 'SLRS'
    | 'GPH'
    | 'NVMD'
    | 'WDS'
    | 'LXO'
    | 'RHOC'
    | 'APHE'
    | 'SYSC'
    | 'CTK'
    | 'NTLK'
    | 'OMGA'
    | 'FNS'
    | 'SGC'
    | 'JGN'
    | 'CTYS'
    | 'MDYN'
    | 'TITN';
  type OrderType = 'limitbuy' | 'limitsell' | 'stopbuy' | 'stopsell';
  type OrderPos = 'long' | 'short';

  export interface ProcessInfo {
    /** Script name. */
    filename: Script;
    /** Number of threads script is running with */
    threads: number;
    /** Script's arguments */
    args: string[];
  }

  export interface HackingMultipliers {
    /** Player's hacking chance multiplier. */
    chance: number;
    /** Player's hacking speed multiplier. */
    speed: number;
    /** Player's hacking money stolen multiplier. */
    money: number;
    /** Player's hacking growth multiplier */
    growth: number;
  }

  export interface HacknetMultipliers {
    /** Player's hacknet production multiplier */
    production: number;
    /** Player's hacknet purchase cost multiplier */
    purchaseCost: number;
    /** Player's hacknet ram cost multiplier */
    ramCost: number;
    /** Player's hacknet core cost multiplier */
    coreCost: number;
    /** Player's hacknet level cost multiplier */
    levelCost: number;
  }

  export type Port = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
  export type Handle = string | Port;

  export interface NodeStats {
    /** Node's name ("hacknet-node-5") */
    name: string;
    /** Node's level */
    level: number;
    /** Node's RAM */
    ram: number;
    /** Node's number of cores */
    cores: number;
    /** Node's money earned per second */
    production: number;
    /** Number of seconds since Node has been purchased */
    timeOnline: number;
    /** Total number of money Node has produced */
    totalProduction: number;
  }

  export interface TIX {
    /**
     * Returns the price of a stock, given its symbol (NOT the company name).
     * The symbol is a sequence of two to four capital letters.
     *
     * @param sym Stock symbol.
     */
    getStockPrice(sym: StockSymbol): number;

    /**
     * Returns an array of four elements that represents the player’s position in a stock.
     *
     * The first element is the returned array is the number of shares the player owns of
     * the stock in the Long position. The second element in the array is the average price
     * of the player’s shares in the Long position.
     *
     * The third element in the array is the number of shares the player owns of the stock
     * in the Short position. The fourth element in the array is the average price of the
     * player’s Short position.
     *
     * @param sym Stock symbol.
     */
    getStockPosition(sym: StockSymbol): [number, number, number, number];

    /**
     * Attempts to purchase shares of a stock using a Market Order.
     *
     * If the player does not have enough money to purchase the specified number of shares,
     * then no shares will be purchased. Remember that every transaction on the stock exchange
     * costs a certain commission fee.
     *
     * If this function successfully purchases the shares, it will return the stock price at which
     * each share was purchased. Otherwise, it will return 0.
     *
     * @param sym Stock symbol.
     * @param shares Number of shares to purchased. Must be positive. Will be rounded to nearest integer.
     */
    buyStock(sym: StockSymbol, shares: number): number;

    /**
     * Attempts to sell shares of a stock using a Market Order.
     *
     * If the specified number of shares in the function exceeds the amount that the player
     * actually owns, then this function will sell all owned shares. Remember that every
     * transaction on the stock exchange costs a certain commission fee.
     *
     * The net profit made from selling stocks with this function is reflected in the script’s
     * statistics. This net profit is calculated as:
     *
     *    shares * (sell_price - average_price_of_purchased_shares)
     *
     * If the sale is successful, this function will return the stock price at
     * which each share was sold. Otherwise, it will return 0.
     *
     * @param sym Stock symbol.
     * @param shares Number of shares to sell. Must be positive. Will be rounded to nearest integer.
     */
    sellStock(sym: StockSymbol, shares: number): number;

    /**
     * Attempts to purchase a short position of a stock using a Market Order.
     *
     * The ability to short a stock is not immediately available to the player and
     * must be unlocked later on in the game.
     *
     * If the player does not have enough money to purchase the specified number of shares,
     * then no shares will be purchased. Remember that every transaction on the stock exchange
     * costs a certain commission fee.
     *
     * If the purchase is successful, this function will return the stock price at which each
     * share was purchased. Otherwise, it will return 0.
     *
     * @param sym Stock symbol.
     * @param shares Number of shares to short. Must be positive. Will be rounded to nearest integer.
     */
    shortStock(sym: StockSymbol, shares: number): number;

    /**
     * Attempts to sell a short position of a stock using a Market Order.
     *
     * The ability to short a stock is not immediately available to the player and
     * must be unlocked later on in the game.
     *
     * If the specified number of shares exceeds the amount that the player actually owns,
     * then this function will sell all owned shares. Remember that every transaction on
     * the stock exchange costs a certain commission fee.
     *
     * If the sale is successful, this function will return the stock price at which each
     * share was sold. Otherwise it will return 0.
     *
     * @param sym Stock symbol.
     * @param shares Number of shares to sell. Must be positive. Will be rounded to nearest integer.
     */
    sellShort(sym: StockSymbol, shares: number): number;

    /**
     * Places an order on the stock market. This function only works for Limit and Stop Orders.
     *
     * The ability to place limit and stop orders is not immediately available to the player and
     * must be unlocked later on in the game.
     *
     * Returns true if the order is successfully placed, and false otherwise.
     *
     * @param sym Stock symbol.
     * @param shares Number of shares for order. Must be positive. Will be rounded to nearest integer.
     * @param price Execution price for the order.
     * @param type Type of order.
     * @param pos Specifies whether the order is a “Long” or “Short” position.
     */
    placeOrder(
      sym: StockSymbol,
      shares: number,
      price: number,
      type: OrderType,
      pos: OrderPos,
    ): boolean;

    /**
     * Cancels an oustanding Limit or Stop order on the stock market.
     *
     * @param sym Stock symbol.
     * @param shares Number of shares for order. Must be positive. Will be rounded to nearest integer.
     * @param price Execution price for the order.
     * @param type Type of order.
     * @param pos Specifies whether the order is a “Long” or “Short” position.
     */
    cancelOrder(
      sym: StockSymbol,
      shares: number,
      price: number,
      type: OrderType,
      pos: OrderPos,
    ): void;
  }

  export interface HackNet {
    /**
     * Returns the number of Hacknet Nodes you own.
     *
     * @returns {number} number of hacknet nodes.
     */
    numNodes(): number;

    /**
     * Purchases a new Hacknet Node. Returns a number with the index of the
     * Hacknet Node. This index is equivalent to the number at the end of
     * the Hacknet Node’s name (e.g The Hacknet Node named `hacknet-node-4`
     * will have an index of 4).
     *
     * If the player cannot afford to purchase a new Hacknet Node then the function will return -1.
     */
    purchaseNode(): number;

    /**
     * Returns the cost of purchasing a new Hacknet Node.
     */
    getPurchaseNodeCost(): number;

    /**
     * Returns an object containing a variety of stats about the specified Hacknet Node.
     *
     * @param {number} index Index/Identifier of Hacknet Node
     */
    getNodeStats(index: number): NodeStats;

    /**
     * Tries to upgrade the level of the specified Hacknet Node by n.
     *
     * Returns true if the Hacknet Node’s level is successfully upgraded by n
     * or if it is upgraded by some positive amount and the Node reaches its max level.
     *
     * Returns false otherwise.
     *
     * @param {number} index Index/Identifier of Hacknet Node.
     * @param {number} n Number of levels to purchase. Must be positive. Rounded to nearest integer.
     */
    upgradeLevel(index: number, n: number): boolean;

    /**
     * Tries to upgrade the ram of the specified Hacknet Node by n.
     *
     * Returns true if the Hacknet Node’s ram is successfully upgraded by n
     * or if it is upgraded by some positive amount and the Node reaches its max ram.
     *
     * Returns false otherwise.
     *
     * @param {number} index Index/Identifier of Hacknet Node.
     * @param {number} n Number of levels to purchase. Must be positive. Rounded to nearest integer.
     */
    upgradeRam(index: number, n: number): boolean;

    /**
     * Tries to upgrade the cores of the specified Hacknet Node by n.
     *
     * Returns true if the Hacknet Node’s cores is successfully upgraded by n
     * or if it is upgraded by some positive amount and the Node reaches its max cores.
     *
     * Returns false otherwise.
     *
     * @param {number} index Index/Identifier of Hacknet Node.
     * @param {number} n Number of levels to purchase. Must be positive. Rounded to nearest integer.
     */
    upgradeCore(index: number, n: number): boolean;

    /**
     * Returns the cost of upgrading the specified Hacknet Node by n levels.
     *
     * @param {number} index Index/Identifier of Hacknet Node.
     * @param {number} n Number of levels to upgrade. Must be positive. Rounded to nearest integer.
     */
    getLevelUpgradeCost(index: number, n: number): number;

    /**
     * Returns the cost of upgrading the specified Hacknet Node's ram by n levels.
     *
     * @param {number} index Index/Identifier of Hacknet Node.
     * @param {number} n Number of levels to upgrade. Must be positive. Rounded to nearest integer.
     */
    getRamUpgradeCost(index: number, n: number): number;

    /**
     * Returns the cost of upgrading the specified Hacknet Node's cores by n levels.
     *
     * @param {number} index Index/Identifier of Hacknet Node.
     * @param {number} n Number of levels to upgrade. Must be positive. Rounded to nearest integer.
     */
    getCoreUpgradeCost(index: number, n: number): number;
  }

  export interface BitBurner extends TIX {
    readonly args: ReadonlyArray<string>;
    readonly hacknet: HackNet;

    /**
     * Function that is used to try and hack servers to steal money and gain hacking experience.
     * The runtime for this command depends on your hacking level and the target server’s
     * security level. In order to hack a server you must first gain root access to that server
     * and also have the required hacking level.
     *
     * A script can hack a server from anywhere. It does not need to be running on the same
     * server to hack that server. For example, you can create a script that hacks the `foodnstuff`
     * server and run that script on any server in the game.
     *
     * A successful `hack()` on a server will raise that server’s security level by 0.002.
     *
     * @param host {string} IP or hostname of the target server to hack.
     * @returns The amount of money stolen if the hack is successful, and zero otherwise.
     */
    hack(host: Host): Promise<number>;

    /**
     * Use your hacking skills to increase the amount of money available on a server.
     * The runtime for this command depends on your hacking level and the target server’s
     * security level. When grow() completes, the money available on a target server will
     * be increased by a certain, fixed percentage. This percentage is determined by the
     * target server’s growth rate (which varies between servers) and security level. Generally,
     * higher-level servers have higher growth rates. The getServerGrowth() function can be used
     * to obtain a server’s growth rate.
     *
     * Like {@link hack}, {@link grow} can be called on any server, regardless of where the script is running.
     * The grow() command requires root access to the target server, but there is no required hacking
     * level to run the command. It also raises the security level of the target server by 0.004.
     *
     * @param host {string} IP or hostname of the target server to grow.
     * @returns The number by which the money on the server was multiplied for the growth.
     */
    grow(host: Host): Promise<number>;

    /**
     * Use your hacking skills to attack a server’s security, lowering the server’s security level.
     * The runtime for this command depends on your hacking level and the target server’s security
     * level. This function lowers the security level of the target server by 0.05.
     *
     * Like {@link hack} and {@link grow}, {@link weaken} can be called on any server, regardless of
     * where the script is running. This command requires root access to the target server, but
     * there is no required hacking level to run the command.
     *
     * @param host {string} IP or hostname of the target server to weaken.
     * @returns The amount by which the target server’s security level was decreased. This is equivalent to 0.05 multiplied by the number of script threads.
     */
    weaken(host: Host): Promise<number>;

    /**
     * Suspends the script for n milliseconds.
     *
     * @param millis Number of milliseconds to sleep.
     */
    sleep(millis: number): Promise<void>;

    /**
     * Prints a value or a variable to the script’s logs.
     *
     * @param msg Value to be printed.
     */
    print(msg: string): void;

    /**
     * Prints a value or a variable to the Terminal.
     *
     * @param msg Value to be printed.
     */
    tprint(msg: string): void;

    /**
     * Clears the script’s logs.
     */
    clearLog(): void;

    /**
     * Disables logging for the given function. Logging can be disabled
     * for all functions by passing `ALL` as the argument.
     *
     * Note that this does not completely remove all logging functionality.
     * This only stops a function from logging when the function is successful.
     * If the function fails, it will still log the reason for failure.
     *
     * Notable functions that cannot have their logs disabled: {@link run},
     * {@link exec}, {@link exit}.
     *
     * @param fn Name of function for which to disable logging.
     */
    disableLog(fn: string): void;

    /**
     * Re-enables logging for the given function. If `ALL` is passed into this
     * function as an argument, then it will revert the effects of disableLog(`ALL`).
     *
     * @param fn Name of function for which to enable logging.
     */
    enableLog(fn: string): void;

    /**
     * Returns an array containing the hostnames or IPs of all servers that are one
     * node way from the specified target server. The hostnames/IPs in the returned
     * array are strings.
     *
     * @param host IP or hostname of the server to scan.
     * @param hostnames Optional boolean specifying whether the function should output hostnames (if true) or IP addresses (if false).
     */
    scan(host: Host, hostnames?: boolean): Array<Host>;

    /**
     * Runs the NUKE.exe program on the target server. NUKE.exe must exist on your home computer.
     *
     * @param host IP or hostname of the target server.
     */
    nuke(host: Host): void;

    /**
     * Runs the BruteSSH.exe program on the target server. BruteSSH.exe must exist on your home computer.
     *
     * @param host IP or hostname of the target server.
     */
    brutessh(host: Host): void;

    /**
     * Runs the FTPCrack.exe program on the target server. FTPCrack.exe must exist on your home computer.
     *
     * @param host IP or hostname of the target server.
     */
    ftpcrack(host: Host): void;

    /**
     * Runs the relaySMTP.exe program on the target server. relaySMTP.exe must exist on your home computer.
     *
     * @param host IP or hostname of the target server.
     */
    relaysmtp(host: Host): void;

    /**
     * Runs the HTTPWorm.exe program on the target server. HTTPWorm.exe must exist on your home computer.
     *
     * @param host IP or hostname of the target server.
     */
    httpworm(host: Host): void;

    /**
     * Runs the SQLInject.exe program on the target server. SQLInject.exe must exist on your home computer.
     *
     * @param host IP or hostname of the target server.
     */
    sqlinject(host: Host): void;

    /**
     * Run a script as a separate process. This function can only be used to run scripts located on the
     * current server (the server running the script that calls this function). Requires a significant
     * amount of RAM to run this command.
     *
     * @param script Filename of script to run.
     * @param numThreads Optional thread count for new script. Set to 1 by default. Will be rounded to nearest integer.
     * @param args Additional arguments to pass into the new script that is being run. Note that if any arguments are being passed into the new script, then the second argument numThreads must be filled in with a value.
     * @returns true if the script is successfully started, and false otherwise.
     */
    run(
      script: Script,
      numThreads?: number,
      ...args: string[]
    ): Promise<boolean>;

    /**
     * Run a script as a separate process on a specified server. This is similar to the run function
     * except that it can be used to run a script on any server, instead of just the current server.
     *
     * @param script Filename of script to execute.
     * @param host IP or hostname of the `target server` on which to execute the script.
     * @param numThreads Optional thread count for new script. Set to 1 by default. Will be rounded to nearest integer.
     * @param args Additional arguments to pass into the new script that is being run. Note that if any arguments are being passed into the new script, then the third argument numThreads must be filled in with a value.
     * @returns true if the script is successfully started, and false otherwise.
     */
    exec(
      script: Script,
      host: Host,
      numThreads?: number,
      ...args: string[]
    ): Promise<boolean>;

    /**
     * Terminates the current script, and then after a delay of about 20 seconds it will execute the
     * newly-specified script. The purpose of this function is to execute a new script without being
     * constrained by the RAM usage of the current one. This function can only be used to run scripts
     * on the local server.
     *
     * Because this function immediately terminates the script, it does not have a return value.
     *
     * @param script Filename of script to execute.
     * @param numThreads Number of threads to spawn new script with. Will be rounded to nearest integer.
     * @param args  Additional arguments to pass into the new script that is being run.
     */
    spawn(script: Script, numThreads?: number, ...args: string[]): void;

    /**
     * Kills the script on the target server specified by the script’s name and arguments.
     * Remember that scripts are uniquely identified by both their name and arguments.
     * For example, if `foo.script` is run with the argument 1, then this is not the same as
     * `foo.script` run with the argument 2, even though they have the same code.
     *
     * @param script Filename of the script to kill
     * @param host IP or hostname of the server on which to kill the script.
     * @param args Arguments to identify which script to kill.
     */
    kill(script: Script, host: Host, ...args: string[]): boolean;

    /**
     * Kills all running scripts on the specified server. This function returns true
     * if any scripts were killed, and false otherwise. In other words, it will return
     * true if there are any scripts running on the target server.
     *
     * @param host IP or hostname of the server on which to kill all scripts.
     */
    killall(host: Host): boolean;

    /**
     * Terminates the current script immediately.
     */
    exit(): void;

    /**
     * Copies a script or literature (.lit) file(s) to another server. The files argument can be either a string
     * specifying a single file to copy, or an array of strings specifying multiple files to copy.
     *
     * @param files Filename or an array of filenames of script/literature files to copy.
     * @param destination Hostname or IP of the destination server, which is the server to which the file will be copied.
     * @returns true if the script/literature file is successfully copied over and false otherwise. If the files argument is an array then this function will return true if at least one of the files in the array is successfully copied.
     */
    scp(files: string | ReadonlyArray<string>, destination: Host): boolean;

    /**
     * Copies a script or literature (.lit) file(s) to another server. The files argument can be either a string
     * specifying a single file to copy, or an array of strings specifying multiple files to copy.
     *
     * @param files Filename or an array of filenames of script/literature files to copy.
     * @param source Hostname or IP of the source server, which is the server from which the file will be copied. This argument is optional and if it’s omitted the source will be the current server.
     * @param destination Hostname or IP of the destination server, which is the server to which the file will be copied.
     * @returns true if the script/literature file is successfully copied over and false otherwise. If the files argument is an array then this function will return true if at least one of the files in the array is successfully copied.
     */
    scp(
      files: string | ReadonlyArray<string>,
      source: Host,
      destination: Host,
    ): boolean;

    /**
     * Returns an array with the filenames of all files on the specified server
     * (as strings). The returned array is sorted in alphabetic order.
     *
     * @param host Hostname or IP of the target server.
     * @param grep A substring to search for in the filename.
     */
    ls(host: Host, grep?: string): Array<string>;

    /**
     * Returns an array with general information about all scripts running on the specified target server.
     *
     * @param host Hostname or IP address of the target server. If not specified, it will be the current server’s IP by default.
     */
    ps(host?: Host): Array<ProcessInfo>;

    /**
     * Returns a boolean indicating whether or not the player has root access to the specified target server.
     *
     * @param host Hostname or IP of the target server
     */
    hasRootAccess(host: Host): boolean;

    /**
     * Returns a string with the hostname of the server that the script is running on.
     */
    getHostname(): Host;

    /**
     * Returns the player’s current hacking level.
     */
    getHackingLevel(): number;

    /**
     * Returns an object containing the Player’s hacking related multipliers.
     * These multipliers are returned in fractional forms, not percentages
     * (e.g. 1.5 instead of 150%).
     */
    getHackingMultipliers(): HackingMultipliers;

    /**
     * Returns an object containing the Player’s hacknet related multipliers.
     * These multipliers are returned in fractional forms, not percentages
     * (e.g. 1.5 instead of 150%).
     */
    getHacknetMultipliers(): HacknetMultipliers;

    /**
     * Returns the amount of money available on a server.
     * Running this function on the home computer will return the player’s money.
     *
     * @param host Hostname or IP of target server
     */
    getServerMoneyAvailable(host: Host): number;

    /**
     * Returns the maximum amount of money that can be available on a server.
     *
     * @param host Hostname or IP of target server.
     */
    getServerMaxMoney(host: Host): number;

    /**
     * Returns the server’s instrinsic “growth parameter”. This growth
     * parameter is a number between 1 and 100 that represents how
     * quickly the server’s money grows. This parameter affects the
     * percentage by which the server’s money is increased when using the
     * {@link grow} function. A higher growth parameter will result in a
     * higher percentage increase from {@link grow}.
     *
     * @param host Hostname or IP of target server.
     */
    getServerGrowth(host: Host): number;

    /**
     * Returns the security level of the target server. A server’s security
     * level is denoted by a number, typically between 1 and 100
     * (but it can go above 100).
     *
     * @param host Hostname or IP of target server.
     */
    getServerSecurityLevel(host: Host): number;

    /**
     * Returns the base security level of the target server. This is the security
     * level that the server starts out with. This is different than
     * {@link getServerSecurityLevel} because {@link getServerSecurityLevel} returns
     * the current security level of a server, which can constantly change due to
     * {@link hack}, {@link grow}, and {@link weaken}, calls on that server.
     * The base security level will stay the same until you reset by
     * installing an Augmentation(s).
     *
     * @param host Hostname or IP of target server.
     */
    getServerBaseSecurityLevel(host: Host): number;

    /**
     * Returns the minimum security level of the target server.
     *
     * @param host Hostname or IP of target server.
     */
    getServerMinSecurityLevel(host: Host): number;

    /**
     * Returns the required hacking level of the target server.
     *
     * @param host Hostname or IP of target server.
     */
    getServerRequiredHackingLevel(host: Host): number;

    /**
     * Returns the number of open ports required to successfully run NUKE.exe on the specified server.
     *
     * @param host Hostname or IP of target server.
     */
    getServerNumPortsRequired(host: Host): number;

    /**
     * Returns an array with two elements that gives information about a server’s memory (RAM).
     * The first element in the array is the amount of RAM that the server has total (in GB).
     * The second element in the array is the amount of RAM that is currently being used on
     * the server (in GB).
     *
     * @param host Hostname or IP of target server.
     */
    getServerRam(host: Host): [number, number];

    /**
     * Returns a boolean denoting whether or not the specified server exists.
     *
     * @param host Hostname or IP of target server.
     */
    serverExists(host: Host): boolean;

    /**
     * Returns a boolean indicating whether the specified file exists on the target server.
     * The filename for scripts is case-sensitive, but for other types of files it is not.
     * For example, fileExists(“brutessh.exe”) will work fine, even though the actual program
     * is named “BruteSSH.exe”.
     *
     * If the hostname/ip argument is omitted, then the function will search through the current
     * server (the server running the script that calls this function) for the file.
     *
     * @param filename Filename of file to check.
     * @param host Hostname or IP of target server. This is optional. If it is not specified then the function will use the current server as the target server.
     */
    fileExists(filename: string, host?: Host): boolean;

    /**
     * Returns a boolean indicating whether the specified script is running on the target server.
     * Remember that a script is uniquely identified by both its name and its arguments.
     *
     * @param script Filename of script to check. This is case-sensitive.
     * @param host Hostname or IP of target server.
     * @param args Arguments to specify/identify which scripts to search for.
     */
    isRunning(script: Script, host: Host, ...args: string[]): boolean;

    /**
     * Returns the cost to purchase a server with the specified amount of ram.
     *
     * @param ram Amount of RAM of a potential purchased server. Must be a power of 2 (2, 4, 8, 16, etc.). Maximum value of 1048576 (2^20).
     */
    getPurchasedServerCost(ram: number): number;

    /**
     * Purchased a server with the specified hostname and amount of RAM.
     *
     * The hostname argument can be any data type, but it will be converted to a string
     * and have whitespace removed. Anything that resolves to an empty string will cause
     * the function to fail. If there is already a server with the specified hostname,
     * then the function will automatically append a number at the end of the hostname
     * argument value until it finds a unique hostname. For example, if the script calls
     * `purchaseServer(“foo”, 4)` but a server named “foo” already exists, the it will
     * automatically change the hostname to `foo-0`. If there is already a server with the
     * hostname `foo-0`, then it will change the hostname to `foo-1`, and so on.
     *
     * Note that there is a maximum limit to the amount of servers you can purchase.
     *
     * Returns the hostname of the newly purchased server as a string. If the function
     * fails to purchase a server, then it will return an empty string. The function will
     * fail if the arguments passed in are invalid, if the player does not have enough
     * money to purchase the specified server, or if the player has exceeded the maximum
     * amount of servers.
     *
     * @param hostname Hostname of the purchased server.
     * @param ram Amount of RAM of the purchased server. Must be a power of 2 (2, 4, 8, 16, etc.). Maximum value of 1048576 (2^20).
     */
    purchaseServer(hostname: Host, ram: number): Host | '';

    /**
     * Deletes one of your purchased servers, which is specified by its hostname.
     *
     * The hostname argument can be any data type, but it will be converted to a string.
     * Whitespace is automatically removed from the string. This function will not delete a
     * server that still has scripts running on it.
     *
     * @param host Hostname of the server to delete.
     * @returns true if successful, and false otherwise.
     */
    deleteServer(host: Host): boolean;

    /**
     * Returns an array with either the hostnames or IPs of all of the servers you have purchased.
     *
     * @param hostname Specifies whether hostnames or IP addresses should be returned. If it’s true then hostnames will be returned, and if false then IPs will be returned. If this argument is omitted then it is true by default.
     */
    getPurchasedServers(hostname?: boolean): Array<Host>;

    /**
     * Returns the maximum number of servers you can purchase.
     */
    getPurchasedServerLimit(): number;

    /**
     * Returns the maximum RAM that a purchased server can have.
     */
    getPurchasedServerMaxRam(): number;

    /**
     * This function can be used to either write data to a port or to a text file (.txt).
     *
     * If the first argument is a number between 1 and 10, then it specifies a port and this
     * function will write data to that port. The third argument, mode, is not used when writing
     * to a port.
     *
     * If the first argument is a string, then it specifies the name of a text file (.txt) and
     * this function will write data to that text file. If the specified text file does not exist,
     * then it will be created. The third argument mode, defines how the data will be written to
     * the text file. If *mode is set to “w”, then the data is written in “write” mode which means
     * that it will overwrite all existing data on the text file. If mode is set to any other value
     * then the data will be written in “append” mode which means that the data will be added at the
     * end of the text file.
     *
     * @param handle Port or text file that will be written to.
     * @param data Data to write.
     * @param mode Defines the write mode. Only valid when writing to text files.
     */
    write(handle: Handle, data?: string, mode?: 'w'): void;

    /**
     * This function is used to read data from a port or from a text file (.txt).
     *
     * If the argument port/fn is a number between 1 and 10, then it specifies a
     * port and it will read data from that port. A port is a serialized queue.
     * This function will remove the first element from that queue and return it.
     * If the queue is empty, then the string “NULL PORT DATA” will be returned.
     *
     * If the argument port/fn is a string, then it specifies the name of a text
     * file (.txt) and this function will return the data in the specified text
     * file. If the text file does not exist, an empty string will be returned.
     *
     * @param handle Port or text file to read from.
     */
    read(handle: Handle): string;

    /**
     * This function is used to peek at the data from a port. It returns the
     * first element in the specified port without removing that element. If
     * the port is empty, the string “NULL PORT DATA” will be returned.
     *
     * @param port Port to peek. Must be an integer between 1 and 10.
     */
    peek(port: Port): string;

    /**
     * This function is used to clear data in a Netscript Ports or a text file.
     *
     * If the port/fn argument is a number between 1 and 10, then it specifies a
     * port and will clear it (deleting all data from the underlying queue).
     *
     * If the port/fn argument is a string, then it specifies the name of a
     * text file (.txt) and will delete all data from that text file.
     *
     * @param port Port or text file to clear.
     */
    clear(handle: Handle): void;

    /**
     * Removes the specified file from the current server. This function works for every file
     * type except message (.msg) files.
     *
     * @param name Filename of file to remove. Must include the extension.
     * @returns True if it successfully deletes the file, and false otherwise.
     */
    rm(name: string): boolean;

    /**
     * Returns a boolean indicating whether any instance of the specified script is running
     * on the target server, regardless of its arguments.
     *
     * This is different than the {@link isRunning} function because it does not try to
     * identify a specific instance of a running script by its arguments.
     *
     * @param script Filename of script to check. This is case-sensitive.
     * @param host Hostname or IP of target server.
     */
    scriptRunning(script: Script, host: Host): boolean;

    /**
     * Kills all scripts with the specified filename on the target server specified by hostname/ip,
     * regardless of arguments.
     *
     * @param script Filename of script to kill. This is case-sensitive.
     * @param host Hostname or IP of target server.
     * @return true if one or more scripts were successfully killed, and false if none were.
     */
    scriptKill(script: Script, host: Host): boolean;

    /**
     * Returns the current script name.
     */
    getScriptName(): string;

    /**
     * Returns the amount of RAM required to run the specified script on the target server.
     * Returns 0 if the script does not exist.
     *
     * @param script Filename of script. This is case-sensitive.
     * @param host Hostname or IP of target server the script is located on. This is optional, If it is not specified then the function will se the current server as the target server.
     */
    getScriptRam(script: Script, host?: Host): number;

    /**
     * Returns the amount of time in seconds it takes to execute the {@link hack} Netscript function on the target server.
     *
     * @param host Hostname or IP of target server.
     */
    getHackTime(host: Host): number;

    /**
     * Returns the amount of time in seconds it takes to execute the {@link grow} Netscript function on the target server.
     *
     * @param host Hostname or IP of target server.
     */
    getGrowTime(host: Host): number;

    /**
     * Returns the amount of time in seconds it takes to execute the weaken() Netscript function on the target server.
     *
     * @param host Hostname or IP of target server
     */
    getWeakenTime(host: Host): number;

    /**
     * Returns the amount of income the specified script generates while online
     * (when the game is open, does not apply for offline income). Remember that
     * a script is uniquely identified by both its name and its arguments. So for
     * example if you ran a script with the arguments “foodnstuff” and “5” then
     * in order to use this function to get that script’s income you must specify
     * those same arguments in the same order in this function call.
     *
     * @param script Filename of script.
     * @param host Server on which script is running.
     * @param args Arguments that the script is running with.
     */
    getScriptIncome(script: Script, host: Host, ...args: string[]): number;

    /**
     * Returns an array of two values. The first value is the total income ($ / second)
     * of all of your active scripts (scripts that are currently running on any server).
     * The second value is the total income ($ / second) that you’ve earned from scripts
     * since you last installed Augmentations.
     */
    getScriptIncome(): [number, number];

    /**
     * Returns the amount of hacking experience the specified script generates while online
     * (when the game is open, does not apply for offline experience gains). Remember that a
     * script is uniquely identified by both its name and its arguments.
     *
     * This function can also return the total experience gain rate of all of your active
     * scripts by running the function with no arguments.
     *
     * @param {Script} script Filename of script.
     * @param {Host} host Server on which script is running.
     * @param {...string[]} args Arguments that the script is running with
     * @returns {number} amount of hacking experience the specified script generates while online
     */
    getScriptExpGain(script: Script, host: Host, ...args: string[]): number;

    /**
     * Returns the amount of time in milliseconds that have passed since you last installed Augmentations.
     *
     * @returns {number} time in milliseconds
     */
    getTimeSinceLastAug(): number;

    /**
     * Prompts the player with a dialog box with two options: “Yes” and “No”.
     * This function will return true if the player click “Yes” and false if
     * the player clicks “No”. The script’s execution is halted until the player
     * selects one of the options.
     *
     * @param {string} txt Text to appear in the prompt dialog box.
     */
    prompt(txt: string): Promise<boolean>;
  }
}
