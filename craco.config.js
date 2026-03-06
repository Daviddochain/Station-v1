const webpack = require("webpack")

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      webpackConfig.ignoreWarnings = [
        ...(webpackConfig.ignoreWarnings || []),

        // Ignore broken/missing source maps from third-party packages in node_modules
        (warning) =>
          typeof warning?.message === "string" &&
          warning.message.includes("Failed to parse source map"),

        // Extra-safe fallback for source-map-loader module warnings
        {
          module: /node_modules/,
          message: /Failed to parse source map/,
        },
      ]

      webpackConfig.resolve = webpackConfig.resolve || {}
      webpackConfig.resolve.fallback = {
        ...(webpackConfig.resolve.fallback || {}),
        assert: require.resolve("assert"),
        buffer: require.resolve("buffer"),
        crypto: require.resolve("crypto-browserify"),
        process: require.resolve("process/browser"),
        stream: require.resolve("stream-browserify"),
        vm: require.resolve("vm-browserify"),
      }

      webpackConfig.plugins = [
        ...(webpackConfig.plugins || []),
        new webpack.ProvidePlugin({
          Buffer: ["buffer", "Buffer"],
          process: ["process"],
        }),
      ]

      return webpackConfig
    },
  },
}