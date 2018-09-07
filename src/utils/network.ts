import { Server, getHostname } from '../core/server';

import { BitBurner as NS } from 'bitburner';

export type Node = {
  readonly server: Server;
  readonly edges: Set<Node>;
  readonly path: ReadonlyArray<Node>;
};

export const scanNetwork = (ns: NS) => {
  const homeServer: Node = {
    server: new Server(ns, 'home'),
    edges: new Set(),
    path: Object.freeze([]),
  };

  const nodes = new Map<string, Node>();
  nodes.set('home', homeServer);

  const queue = [homeServer];
  let node: Node | undefined;
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

export const flattenNetwork = (root: Node): ReadonlyArray<Node> => {
  const servers = new Set<Node>();
  const queue = [root];
  let node: Node | undefined;
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

export const findNode = (
  root: Node,
  match: (node: Node) => boolean,
): Node | null => {
  const servers = new Set<Node>();
  const queue = [root];
  let node: Node | undefined;
  while ((node = queue.shift())) {
    if (match(node)) {
      return node;
    }

    servers.add(node);
    for (const edge of node.edges) {
      if (!servers.has(edge)) {
        queue.push(edge);
      }
    }
  }

  return null;
};
