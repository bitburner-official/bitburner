import execa from 'execa';
import fs from 'fs';
import glob from 'glob';
import mkdirp from 'mkdirp';
import path from 'path';
import { promisify } from 'util';
import typescript from 'rollup-plugin-typescript2';

const getCurrentHash = async () => {
  const hash = await execa('git', ['rev-parse', 'HEAD']);
  const status = await execa('git', ['status', '-s']);
  if (status.stdout.trim().length === 0) return hash.stdout.trim();
  return `Dirty.` + hash.stdout.trim();
};

const _generateBundle = async (ctx, outputOptions, bundle, isWrite) => {
  const scripts = Object.keys(bundle).filter(n => !n.includes('chunk'));
  bundle[`manifest.json`] = JSON.stringify(
    {
      scripts,
      hash: await getCurrentHash(),
    },
    null,
    2,
  );

  bundle[`wget.txt`] = scripts
    .map(
      fpath =>
        `wget https://alxandr.github.io/bitburner/${fpath} ${path.basename(
          fpath,
        )}\n`,
    )
    .join('');
};

const customPlugin = () => ({
  name: 'manifest',
  generateBundle(outputOptions, bundle, isWrite) {
    return _generateBundle(this, outputOptions, bundle, isWrite);
  },
});

const conf = async () => {
  const scripts = await promisify(glob)('./src/scripts/*.ts');
  await mkdirp('dist');
  await promisify(fs.writeFile)(
    path.resolve('dist', 'manifest.json'),
    JSON.stringify(
      {
        scripts: scripts.map(s => path.basename(s, '.ts') + '.js'),
        hash: await getCurrentHash(),
      },
      null,
      2,
    ),
    'utf-8',
  );
  // const plugins = [typescript(), customPlugin()];
  // const output = {
  //   format: 'es',
  //   dir: 'dist',
  //   chunkFileNames: `[name].[hash].js`,
  // };
  // const input = scripts;
  // return {
  //   input,
  //   output,
  //   plugins,
  //   experimentalCodeSplitting: true,
  //   optimizeChunks: true,
  //   chunkGroupingSize: Number.MAX_SAFE_INTEGER,
  // };
  return scripts.map(scriptPath => {
    const input = scriptPath;
    const output = {
      file: path.join('dist', path.basename(scriptPath, '.ts') + '.js'),
      format: 'es',
    };

    const plugins = [typescript()];
    return { input, output, plugins };
  });
};

export default conf();
