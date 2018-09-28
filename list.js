const getPlayerHackingLevel = (ns) => ns.getHackingLevel();
const hasBrutessh = (ns) => ns.fileExists('brutessh.exe', 'home');
const hasFtpcrack = (ns) => ns.fileExists('ftpcrack.exe', 'home');
const hasRelaysmtp = (ns) => ns.fileExists('relaysmtp.exe', 'home');
const hasHttpworm = (ns) => ns.fileExists('httpworm.exe', 'home');
const hasSqlinject = (ns) => ns.fileExists('sqlinject.exe', 'home');

const _hostname = Symbol('server:hostname');
const _ns = Symbol('ns');
var HackStatus;
(function (HackStatus) {
    HackStatus[HackStatus["Hacked"] = 0] = "Hacked";
    HackStatus[HackStatus["NeedsLevel"] = 1] = "NeedsLevel";
    HackStatus[HackStatus["NeedsPorts"] = 2] = "NeedsPorts";
})(HackStatus || (HackStatus = {}));
class Server {
    constructor(ns, hostname) {
        this[_hostname] = hostname;
        this[_ns] = ns;
        Object.freeze(this);
    }
    toString() {
        return this[_hostname];
    }
}
const getHostname = (server) => server[_hostname];
const hasRootAccess = (server) => server[_ns].hasRootAccess(server[_hostname]);
const getAvailableMoney = (server) => server[_ns].getServerMoneyAvailable(server[_hostname]);
const getMaxMoney = (server) => server[_ns].getServerMaxMoney(server[_hostname]);
const getSecurityLevel = (server) => server[_ns].getServerSecurityLevel(server[_hostname]);
const getMinSecurityLevel = (server) => server[_ns].getServerMinSecurityLevel(server[_hostname]);
const getRequiredHackingLevel = (server) => server[_ns].getServerRequiredHackingLevel(server[_hostname]);
const getRequiredPortCount = (server) => server[_ns].getServerNumPortsRequired(server[_hostname]);
const isPlayerOwned = (server) => server[_hostname] === 'home' ||
    server[_ns].getPurchasedServers().includes(server[_hostname]);
const getHackStatus = (server) => {
    if (hasRootAccess(server))
        return HackStatus.Hacked;
    if (getRequiredHackingLevel(server) > getPlayerHackingLevel(server[_ns]))
        return HackStatus.NeedsLevel;
    let ports = getRequiredPortCount(server);
    if (hasBrutessh(server[_ns])) {
        server[_ns].brutessh(server[_hostname]);
        ports--;
    }
    if (hasFtpcrack(server[_ns])) {
        server[_ns].ftpcrack(server[_hostname]);
        ports--;
    }
    if (hasHttpworm(server[_ns])) {
        server[_ns].httpworm(server[_hostname]);
        ports--;
    }
    if (hasRelaysmtp(server[_ns])) {
        server[_ns].relaysmtp(server[_hostname]);
        ports--;
    }
    if (hasSqlinject(server[_ns])) {
        server[_ns].sqlinject(server[_hostname]);
        ports--;
    }
    if (ports <= 0) {
        server[_ns].nuke(server[_hostname]);
        if (!hasRootAccess(server))
            return HackStatus.NeedsPorts;
        return HackStatus.Hacked;
    }
    return HackStatus.NeedsPorts;
};

const scanNetwork = (ns) => {
    const homeServer = {
        server: new Server(ns, 'home'),
        edges: new Set(),
        path: Object.freeze([]),
    };
    const nodes = new Map();
    nodes.set('home', homeServer);
    const queue = [homeServer];
    let node;
    while ((node = queue.shift())) {
        const neighbors = ns.scan(getHostname(node.server));
        for (const neighbor of neighbors) {
            let neighborNode = nodes.get(neighbor);
            if (!neighborNode) {
                neighborNode = {
                    server: new Server(ns, neighbor),
                    edges: new Set(),
                    path: Object.freeze([...node.path, node]),
                };
                nodes.set(neighbor, neighborNode);
                queue.push(neighborNode);
            }
            node.edges.add(neighborNode);
            neighborNode.edges.add(node);
        }
    }
    return homeServer;
};
const flattenNetwork = (root) => {
    const servers = new Set();
    const queue = [root];
    let node;
    while ((node = queue.shift())) {
        servers.add(node);
        for (const edge of node.edges) {
            if (!servers.has(edge)) {
                queue.push(edge);
            }
        }
    }
    return [...servers];
};

const formatters = new WeakMap();
const getFormatter = (v) => {
    if (v === null)
        return null;
    const formatter = formatters.get(v);
    return formatter || getFormatter(Object.getPrototypeOf(v));
};
const arg = (v) => {
    if (typeof v === 'undefined')
        return '<undefined>';
    if (v === null)
        return '<null>';
    const formatter = getFormatter(v);
    if (formatter)
        return formatter(v);
    if (typeof v.toLocaleString === 'function')
        return v.toLocaleString('en-us');
    return String(v);
};
const prettifyString = (literals, ...placeholders) => {
    let result = '';
    for (let i = 0; i < placeholders.length; i++) {
        result += literals[i];
        result += arg(placeholders[i]);
    }
    // add the last literal
    result += literals[literals.length - 1];
    return result;
};
const maybeStr = (prefix) => typeof prefix === 'string' ? prefix : '';
const createTerminalLogger = (ns, prefix) => (literals, ...placeholders) => ns.tprint(maybeStr(prefix) + prettifyString(literals, ...placeholders));

const CONTROL = '(?:' + ['\\|\\|', '\\&\\&', ';;', '\\|\\&', '[&;()|<>]'].join('|') + ')';
const META = '|&;()<> \\t';
const BAREWORD = '(\\\\[\'"' + META + ']|[^\\s\'"' + META + '])+';
const SINGLE_QUOTE = '"((\\\\"|[^"])*?)"';
const DOUBLE_QUOTE = "'((\\\\'|[^'])*?)'";
const shellParse = (args) => {
    const s = args.join(' ');
    const chunker = new RegExp([
        '(' + CONTROL + ')',
        '(' + BAREWORD + '|' + SINGLE_QUOTE + '|' + DOUBLE_QUOTE + ')*',
    ].join('|'), 'g');
    const maybeMatch = s.match(chunker);
    if (!maybeMatch)
        return [];
    const match = maybeMatch.filter(Boolean);
    return match.map((s, j) => {
        // Hand-written scanner/parser for Bash quoting rules:
        //
        //  1. inside single quotes, all characters are printed literally.
        //  2. inside double quotes, all characters are printed literally
        //     except variables prefixed by '$' and backslashes followed by
        //     either a double quote or another backslash.
        //  3. outside of any quotes, backslashes are treated as escape
        //     characters and not printed (unless they are themselves escaped)
        //  4. quote context can switch mid-token if there is no whitespace
        //     between the two quote contexts (e.g. all'one'"token" parses as
        //     "allonetoken")
        const SQ = "'";
        const DQ = '"';
        const BS = '\\';
        let quote = false;
        let esc = false;
        let out = '';
        for (let i = 0, len = s.length; i < len; i++) {
            let c = s.charAt(i);
            if (esc) {
                out += c;
                esc = false;
            }
            else if (quote) {
                if (c === quote) {
                    quote = false;
                }
                else if (quote == SQ) {
                    out += c;
                }
                else {
                    // Double quote
                    if (c === BS) {
                        i += 1;
                        c = s.charAt(i);
                        if (c === DQ || c === BS) {
                            out += c;
                        }
                        else {
                            out += BS + c;
                        }
                    }
                    else {
                        out += c;
                    }
                }
            }
            else if (c === DQ || c === SQ) {
                quote = c;
            }
            else if (c === BS) {
                esc = true;
            }
            else {
                out += c;
            }
        }
        return out;
    });
};
const isNumber = (x) => {
    if (typeof x === 'number')
        return true;
    if (/^0x[0-9a-f]+$/i.test(String(x)))
        return true;
    return /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(e[-+]?\d+)?$/.test(String(x));
};
const hasKey = (obj, keys) => {
    let o = obj;
    keys.slice(0, -1).forEach(key => {
        o = o[key] || {};
    });
    const key = keys[keys.length - 1];
    return Object.prototype.hasOwnProperty.call(o, key);
};
const parseArgs = (ns, opts = {}) => {
    let args = shellParse(ns.args);
    const flags = { allBools: false, bools: {}, strings: {}, unknownFn: null };
    const { unknown, boolean } = opts;
    if (typeof unknown === 'function') {
        flags.unknownFn = unknown;
    }
    const aliases = {};
    Object.keys(opts.alias || {}).forEach(key => {
        aliases[key] = [].concat(opts.alias[key]);
        aliases[key].forEach(x => {
            aliases[x] = [key].concat(aliases[key].filter(y => x !== y));
        });
    });
    if (typeof boolean === 'boolean' && boolean) {
        flags.allBools = true;
    }
    else {
        []
            .concat(boolean)
            .filter(Boolean)
            .forEach(key => {
            flags.bools[key] = true;
            (aliases[key] || []).forEach(alias => {
                flags.bools[alias] = true;
            });
        });
    }
    []
        .concat(opts.string)
        .filter(Boolean)
        .forEach(key => {
        flags.strings[key] = true;
        (aliases[key] || []).forEach(alias => {
            flags.strings[alias] = true;
        });
    });
    const defaults = opts['default'] || {};
    const argDefined = (key, arg) => (flags.allBools && /^--[^=]+$/.test(arg)) ||
        flags.strings[key] ||
        flags.bools[key] ||
        aliases[key];
    const setKey = (obj, keys, value) => {
        let o = obj;
        keys.slice(0, -1).forEach(key => {
            if (typeof o[key] === 'undefined')
                o[key] = {};
            o = o[key];
        });
        const key = keys[keys.length - 1];
        if (typeof o[key] === 'undefined' ||
            flags.bools[key] ||
            typeof o[key] === 'boolean') {
            o[key] = value;
        }
        else if (Array.isArray(o[key])) {
            o[key].push(value);
        }
        else {
            o[key] = [o[key], value];
        }
    };
    const setArg = (key, val, arg) => {
        if (arg && flags.unknownFn && !argDefined(key, arg)) {
            if (flags.unknownFn(arg) === false)
                return;
        }
        var value = !flags.strings[key] && isNumber(val) ? Number(val) : val;
        setKey(argv, key.split('.'), value);
        (aliases[key] || []).forEach(function (x) {
            setKey(argv, x.split('.'), value);
        });
    };
    var argv = { _: [] };
    Object.keys(flags.bools).forEach(key => {
        setArg(key, defaults[key] === undefined ? false : defaults[key]);
    });
    let notFlags = [];
    if (args.indexOf('--') !== -1) {
        notFlags = args.slice(args.indexOf('--') + 1);
        args = args.slice(0, args.indexOf('--'));
    }
    for (var i = 0; i < args.length; i++) {
        var arg = args[i];
        if (/^--.+=/.test(arg)) {
            // Using [\s\S] instead of . because js doesn't support the
            // 'dotall' regex modifier. See:
            // http://stackoverflow.com/a/1068308/13216
            const m = arg.match(/^--([^=]+)=([\s\S]*)$/);
            const key = m[1];
            let value = m[2];
            if (flags.bools[key]) {
                value = value !== 'false';
            }
            setArg(key, value, arg);
        }
        else if (/^--no-.+/.test(arg) &&
            flags.bools[arg.match(/^--no-(.+)/)[1]]) {
            const key = arg.match(/^--no-(.+)/)[1];
            setArg(key, false, arg);
        }
        else if (/^--.+/.test(arg)) {
            var key = arg.match(/^--(.+)/)[1];
            var next = args[i + 1];
            if (next !== undefined &&
                !/^-/.test(next) &&
                !flags.bools[key] &&
                !flags.allBools) {
                setArg(key, next, arg);
                i++;
            }
            else if (/^(true|false)$/.test(next)) {
                setArg(key, next === 'true', arg);
                i++;
            }
            else {
                setArg(key, flags.strings[key] ? '' : true, arg);
            }
        }
        else if (/^-[^-]+/.test(arg)) {
            var letters = arg.slice(1, -1).split('');
            var broken = false;
            for (var j = 0; j < letters.length; j++) {
                var next = arg.slice(j + 2);
                if (next === '-') {
                    setArg(letters[j], next, arg);
                    continue;
                }
                if (/[A-Za-z]/.test(letters[j]) && /=/.test(next)) {
                    setArg(letters[j], next.split('=')[1], arg);
                    broken = true;
                    break;
                }
                if (/[A-Za-z]/.test(letters[j]) &&
                    /-?\d+(\.\d*)?(e-?\d+)?$/.test(next)) {
                    setArg(letters[j], next, arg);
                    broken = true;
                    break;
                }
                if (letters[j + 1] && letters[j + 1].match(/\W/)) {
                    setArg(letters[j], arg.slice(j + 2), arg);
                    broken = true;
                    break;
                }
                else {
                    setArg(letters[j], flags.strings[letters[j]] ? '' : true, arg);
                }
            }
            var key = arg.slice(-1)[0];
            if (!broken && key !== '-') {
                if (args[i + 1] &&
                    !/^(-|--)[^-]/.test(args[i + 1]) &&
                    !flags.bools[key]) {
                    setArg(key, args[i + 1], arg);
                    i++;
                }
                else if (args[i + 1] && /true|false/.test(args[i + 1])) {
                    setArg(key, args[i + 1] === 'true', arg);
                    i++;
                }
                else {
                    setArg(key, flags.strings[key] ? '' : true, arg);
                }
            }
        }
        else {
            if (!flags.unknownFn || flags.unknownFn(arg) !== false) {
                argv._.push(arg);
            }
            if (opts.stopEarly) {
                argv._.push.apply(argv._, args.slice(i + 1));
                break;
            }
        }
    }
    Object.keys(defaults).forEach(function (key) {
        if (!hasKey(argv, key.split('.'))) {
            setKey(argv, key.split('.'), defaults[key]);
            (aliases[key] || []).forEach(function (x) {
                setKey(argv, x.split('.'), defaults[key]);
            });
        }
    });
    if (opts['--']) {
        argv['--'] = [];
        notFlags.forEach(function (key) {
            argv['--'].push(key);
        });
    }
    else {
        notFlags.forEach(function (key) {
            argv._.push(key);
        });
    }
    return argv;
};

const getServerDisplay = (server) => `${getHostname(server)}`;
const getMoneyDisplay = (server) => {
    const money = getAvailableMoney(server);
    const maxMoney = getMaxMoney(server);
    const sec = getSecurityLevel(server);
    const minSec = getMinSecurityLevel(server);
    return `${money.toLocaleString('en-us', {
        style: 'currency',
        currency: 'USD',
    })} (${(money / maxMoney).toLocaleString('en-us', {
        style: 'percent',
    })}) ${sec} SEC/${minSec} MIN`;
};
const main = (ns) => {
    const args = parseArgs(ns, {
        boolean: ['hacked', 'no-summary', 'money', 'include-owned', 'help'],
        alias: {
            hacked: 'h',
            money: 'm',
            'include-owned': 'o',
            'no-summary': 'n',
        },
        default: {
            hacked: false,
            money: false,
            'include-owned': false,
            'no-summary': false,
        },
    });
    const help = args.help;
    const hackedOnly = args.h;
    const moneyOnly = args.m;
    const noSummary = args.n;
    const includeOwned = args.o;
    const terminal = createTerminalLogger(ns);
    const network = scanNetwork(ns);
    let flattened = flattenNetwork(network).map(node => ({
        server: node.server,
        status: getHackStatus(node.server),
    }));
    if (help) {
        terminal `=== LIST ===`;
        terminal `h|hacked          only hacked nodes`;
        terminal `m|money           show server money and security for hacked nodes`;
        terminal `o|include-owned   include owned servers (home and purchased servers) in output`;
        terminal `n|no-summary      don't print summary`;
        terminal `help              print this help`;
        return;
    }
    if (!includeOwned) {
        flattened = flattened.filter(({ server }) => !isPlayerOwned(server));
    }
    if (hackedOnly) {
        flattened = flattened.filter(({ status }) => status === HackStatus.Hacked);
    }
    if (moneyOnly) {
        flattened = flattened.filter(({ server }) => getAvailableMoney(server) > 0);
    }
    const hacked = flattened.filter(({ status }) => status === HackStatus.Hacked);
    const needsLevel = flattened.filter(({ status }) => status === HackStatus.NeedsLevel);
    const needsPorts = flattened.filter(({ status }) => status === HackStatus.NeedsPorts);
    let output = false;
    if (hacked.length > 0) {
        output = true;
        terminal `=== Hacked ===`;
        for (const { server } of hacked) {
            if (moneyOnly) {
                terminal `${getServerDisplay(server)}: ${getMoneyDisplay(server)}`;
            }
            else {
                terminal `${getServerDisplay(server)}`;
            }
        }
    }
    if (needsLevel.length > 0) {
        if (output) {
            terminal ``;
        }
        output = true;
        terminal `=== Needs level ===`;
        for (const { server } of needsLevel) {
            terminal `${getServerDisplay(server)}: Needs level ${getRequiredHackingLevel(server)}`;
        }
    }
    if (needsPorts.length > 0) {
        if (output) {
            terminal ``;
        }
        output = true;
        terminal `=== Needs ports ===`;
        for (const { server } of needsPorts) {
            terminal `${getServerDisplay(server)}: Needs ports ${getRequiredPortCount(server)}`;
        }
    }
    if (!noSummary) {
        if (output) {
            terminal ``;
        }
        output = true;
        terminal `=== Summary ===`;
        terminal `Hacked: ${hacked.length}`;
        terminal `Needs level: ${needsLevel.length}`;
        terminal `Needs ports: ${needsPorts.length}`;
        if (moneyOnly) {
            const moneyServers = hacked.filter(({ server }) => !isPlayerOwned(server));
            const money = moneyServers.reduce((num, { server }) => num + getAvailableMoney(server), 0);
            const potential = moneyServers.reduce((num, { server }) => num + getMaxMoney(server), 0);
            terminal `Total available money: ${money.toLocaleString('en-us', {
                style: 'currency',
                currency: 'USD',
            })}`;
            terminal `Total potential money: ${potential.toLocaleString('en-us', {
                style: 'currency',
                currency: 'USD',
            })}`;
        }
    }
};

export { main };
