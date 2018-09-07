import glob from 'glob';
import path from 'path';
import { promisify } from 'util';
import typescript from 'rollup-plugin-typescript2';

const conf = async () => {
  const scripts = await promisify(glob)('./src/scripts/*.ts');
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
