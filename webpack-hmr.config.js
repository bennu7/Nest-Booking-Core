const { merge } = require('webpack-merge');
const nodeExternals = require('webpack-node-externals');
const { RunScriptWebpackPlugin } = require('run-script-webpack-plugin');
/**
 * Ensures Prisma-generated imports (`./foo.js` → `foo.ts`) work with webpack's resolver.
 * Applied on the compiler instance because other plugins may mutate `resolve` after merge.
 */
class ForceTsExtensionAliasPlugin {
  apply(compiler) {
    compiler.hooks.environment.tap('ForceTsExtensionAliasPlugin', () => {
      const r = compiler.options.resolve || {};
      compiler.options.resolve = {
        ...r,
        fullySpecified: false,
        extensionAlias: {
          ...r.extensionAlias,
          '.js': ['.ts', '.tsx', '.js'],
        },
      };
    });
  }
}

/**
 * Nest CLI merges this with its defaults (ts-loader, tsconfig-paths, etc.).
 * @see https://docs.nestjs.com/recipes/hot-reload
 *
 * HMR only when the CLI runs with `--watch`.
 */
module.exports = function (options, webpack) {
  const withResolve = merge(options, {
    plugins: [new ForceTsExtensionAliasPlugin()],
  });

  const isWatch = process.argv.includes('--watch');

  if (!isWatch) {
    return withResolve;
  }

  return {
    ...withResolve,
    entry: ['webpack/hot/poll?100', withResolve.entry],
    externals: [
      nodeExternals({
        allowlist: ['webpack/hot/poll?100'],
      }),
    ],
    plugins: [
      ...withResolve.plugins,
      new webpack.HotModuleReplacementPlugin(),
      new webpack.WatchIgnorePlugin({
        paths: [/\.js$/, /\.d\.ts$/],
      }),
      new RunScriptWebpackPlugin({
        name: withResolve.output.filename,
        autoRestart: true,
      }),
    ],
  };
};
