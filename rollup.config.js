import copyAssets from 'rollup-plugin-copy-glob';
import execa from 'execa';
import fs from 'fs';
import glob from 'glob';
import mkdirp from 'mkdirp';
import path from 'path';
import { promisify } from 'util';
import svelte from 'rollup-plugin-svelte';
import typescript from 'rollup-plugin-typescript2';

const getCurrentHash = async () => {
  const hash = await execa('git', ['rev-parse', 'HEAD']);
  const status = await execa('git', ['status', '-s']);
  if (status.stdout.trim().length === 0) return hash.stdout.trim();
  return `Dirty.` + hash.stdout.trim();
};

const appendToManifest = async (scripts, hash) => {
  const manifestFile = path.resolve(__dirname, 'dist', 'manifest.json');
  let manifest = { hash, scripts: [] };
  try {
    const json = await promisify(fs.readFile)(manifestFile, {
      encoding: 'utf-8',
    });
    const fromFile = JSON.parse(json);
    if (fromFile.hash === hash) {
      manifest = fromFile;
    }
  } catch (e) {}

  manifest.date = Date.now();
  manifest.scripts.push(...scripts);
  await promisify(fs.writeFile)(
    manifestFile,
    JSON.stringify(manifest, null, 2),
    'utf-8',
  );
};

const _generateBundle = async (
  ctx,
  outputOptions,
  bundle,
  isWrite,
  currentHash,
) => {
  const scripts = Object.keys(bundle).filter(n => !n.includes('chunk'));
  await appendToManifest(scripts, currentHash);
};

const customPlugin = currentHash => ({
  name: 'manifest',
  generateBundle(outputOptions, bundle, isWrite) {
    return _generateBundle(this, outputOptions, bundle, isWrite, currentHash);
  },
});

const conf = async () => {
  const currentHash = await getCurrentHash();
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

  return [
    ...scripts.map(scriptPath => {
      const input = scriptPath;
      const output = {
        file: path.resolve(
          __dirname,
          'dist',
          path.basename(scriptPath, '.ts') + '.js',
        ),
        format: 'es',
      };

      const plugins = [typescript(), customPlugin(currentHash)];
      return { input, output, plugins };
    }),

    {
      input: path.resolve(__dirname, 'src', 'site', 'index.js'),
      output: {
        file: path.resolve(__dirname, 'dist', 'site.js'),
        format: 'iife',
        name: 'site',
      },
      plugins: [
        typescript(),
        svelte({
          dev: true,
          customelement: true,

          // Emit CSS as "files" for other plugins to process
          // emitCss: true,

          // Extract CSS into a separate file.
          css: function(css) {
            // creates `main.css` and `main.css.map` — pass `false`
            // as the second argument if you don't want the sourcemap
            css.write('dist/css/site.css');
          },
        }),
        copyAssets(
          [
            {
              files: path.resolve(__dirname, 'public', '**', '*'),
              dest: 'dist',
            },
          ],
          {
            watch: false,
            verbose: true,
          },
        ),
      ],
    },
  ];
};

export default conf();
