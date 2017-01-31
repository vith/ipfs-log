'use strict'

const webpack = require('webpack')
const path = require('path')

module.exports = {
  entry: './src/log.js',
  output: {
    libraryTarget: 'var',
    library: 'Log',
    filename: './dist/ipfslog.min.js'
  },
  plugins: [
    new webpack.optimize.UglifyJsPlugin({
      mangle: false,
      compress: { warnings: false }
    })
  ],
  resolve: {
    modules: [
      'node_modules',
      path.resolve(__dirname, '../node_modules')
    ]
  },
  resolveLoader: {
    modules: [
      'node_modules',
      path.resolve(__dirname, '../node_modules')
    ],
    moduleExtensions: ['-loader']
  },
  node: {
    console: false,
    Buffer: true
  },
  plugins: [],
  target: 'web'
}
