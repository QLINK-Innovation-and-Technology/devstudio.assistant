// @ts-check
const path = require('path');

/** @type {import('webpack').Configuration[]} */
module.exports = [
  // Extension Host bundle (Node.js / CommonJS)
  {
    name: 'extension',
    target: 'node',
    entry: './src/extension/extension.ts',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'extension.js',
      libraryTarget: 'commonjs2',
    },
    externals: {
      vscode: 'commonjs vscode',
    },
    resolve: {
      extensions: ['.ts', '.js'],
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
      ],
    },
    devtool: 'source-map',
  },

  // Webview bundle (browser / React)
  {
    name: 'webview',
    target: 'web',
    entry: './src/webview/index.tsx',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'webview.js',
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
      ],
    },
    devtool: 'source-map',
  },

  // DAG webview bundle (browser / React Flow)
  {
    name: 'webview-dag',
    target: 'web',
    entry: './src/webview-dag/index.tsx',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'webview-dag.js',
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
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
          use: ['style-loader', 'css-loader'],
        },
      ],
    },
    devtool: 'source-map',
  },
];
