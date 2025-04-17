const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  entry: {
    popup: './src/popup/popup.ts',
    newtab: './src/newtab/newtab.ts',
    background: './src/background/index.ts',
    kanban: './src/kanban/kanban.ts',
    settings: './src/settings/settings.ts'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.css$/i,
        use: [
          {
            loader: MiniCssExtractPlugin.loader,
            options: {
              publicPath: '../' // Helps with asset URLs in CSS
            }
          },
          'css-loader'
        ]
      },
      {
        test: /\.(png|jpg|jpeg|gif|webp|svg)$/,
        type: 'asset/resource',
        generator: {
          filename: 'assets/images/[hash][ext][query]'
        }
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/,
        type: 'asset/resource',
        generator: {
          filename: 'assets/fonts/[hash][ext][query]'
        }
      }
    ]
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/popup/popup.html',
      filename: 'popup.html',
      chunks: ['popup']
    }),
    new HtmlWebpackPlugin({
      template: './src/newtab/newtab.html',
      filename: 'newtab.html',
      chunks: ['newtab']
    }),
    new HtmlWebpackPlugin({
      template: './src/kanban/kanban.html',
      filename: 'kanban.html',
      chunks: ['kanban']
    }),
    new HtmlWebpackPlugin({
      template: './src/settings/settings.html',
      filename: 'settings.html',
      chunks: ['settings']
    }),
    new MiniCssExtractPlugin({
      filename: '[name].css'
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'manifest.json', to: '.' },
        { from: 'assets', to: 'assets' }
      ]
    }),
    {apply: (compiler) => {
      compiler.hooks.emit.tap('FileList', (compilation) => {
        console.log('Emitted files:', Object.keys(compilation.assets));
      });
    }}
  ],
  devServer: {
    static: {
      directory: path.join(__dirname, 'dist')
    },
    compress: true,
    port: 9000,
    devMiddleware: {
      writeToDisk: true
    }
  },
  optimization: {
    splitChunks: {
      chunks: 'all',
      name: 'vendor'
    },
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            // drop_console: true,
          },
        },
      }),
    ],
  }
};