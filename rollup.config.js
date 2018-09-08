import execa from 'execa';
import glob from 'glob';
import { promisify } from 'util';
import typescript from 'rollup-plugin-typescript2';

const getCurrentHash = async () => {
  const hash = await execa('git', ['rev-parse', 'HEAD']);
  const status = await execa('git', ['status', '-s']);
  if (status.stdout.trim().length === 0) return hash.stdout.trim();
  return `Dirty.` + hash.stdout.trim();
};

const _generateBundle = async (ctx, outputOptions, bundle, isWrite) => {
  bundle[`manifest.json`] = JSON.stringify(
    {
      scripts: Object.keys(bundle).filter(n => !n.includes('chunk')),
      hash: await getCurrentHash(),
    },
    null,
    2,
  );
};

const customPlugin = () => ({
  name: 'manifest',
  generateBundle(outputOptions, bundle, isWrite) {
    return _generateBundle(this, outputOptions, bundle, isWrite);
  },
});

const conf = async () => {
  const scripts = await promisify(glob)('./src/scripts/*.ts');
  const plugins = [typescript(), customPlugin()];
  const output = {
    format: 'es',
    dir: 'dist',
    chunkFileNames: `[name].[hash].js`,
  };
  const input = scripts;
  return {
    input,
    output,
    plugins,
    experimentalCodeSplitting: true,
  };
  // return scripts.map(scriptPath => {
  //   const input = scriptPath;
  //   const output = {
  //     file: path.join('dist', path.basename(scriptPath, '.ts') + '.js'),
  //     format: 'es',
  //   };

  //   const plugins = [typescript(), customPlugin];
  //   return { input, output, plugins };
  // });
};

export default conf();
