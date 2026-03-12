const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'development',
  devtool: 'cheap-source-map',

  entry: {
    'side-panel/index': './src/side-panel/index.tsx',
    'options/index': './src/options/index.tsx',
    'background/service-worker': './src/background/service-worker.ts',
    'offscreen/offscreen': './src/offscreen/offscreen.ts',
    'wizard/index': './src/wizard/index.tsx',
    'content-scripts/user-script-runner': './src/content-scripts/user-script-runner.ts',
    'content-scripts/grant-bridge': './src/content-scripts/grant-bridge.ts',
    'content-scripts/env-bridge': './src/content-scripts/env-bridge.ts',
  },

  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true,
  },

  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },

  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader', 'postcss-loader'],
      },
    ],
  },

  optimization: {
    // Prevent shared runtime chunk from being extracted — each entry is self-contained
    runtimeChunk: false,
    splitChunks: {
      // Don't split content scripts — they must be self-contained single files
      chunks: (chunk) => {
        const noSplit = [
          'content-scripts/user-script-runner',
          'content-scripts/grant-bridge',
          'content-scripts/env-bridge',
          'background/service-worker',
          'offscreen/offscreen',
        ];
        return !noSplit.includes(chunk.name);
      },
    },
  },

  plugins: [
    new HtmlWebpackPlugin({
      template: './src/side-panel/index.html',
      filename: 'side-panel/index.html',
      chunks: ['side-panel/index'],
    }),
    new HtmlWebpackPlugin({
      template: './src/options/index.html',
      filename: 'options/index.html',
      chunks: ['options/index'],
    }),
    new HtmlWebpackPlugin({
      template: './src/offscreen/offscreen.html',
      filename: 'offscreen/offscreen.html',
      chunks: ['offscreen/offscreen'],
    }),
    new HtmlWebpackPlugin({
      template: './src/wizard/wizard.html',
      filename: 'wizard/wizard.html',
      chunks: ['wizard/index'],
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'manifest.json', to: 'manifest.json' },
        { from: 'src/icons', to: 'icons' },
      ],
    }),
  ],
};
