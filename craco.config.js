const webpack = require("webpack")
const path = require("path")

function patchSassLoader(rules) {
  if (!Array.isArray(rules)) return

  for (const rule of rules) {
    if (Array.isArray(rule.oneOf)) {
      patchSassLoader(rule.oneOf)
    }

    if (Array.isArray(rule.rules)) {
      patchSassLoader(rule.rules)
    }

    if (!Array.isArray(rule.use)) continue

    for (const useEntry of rule.use) {
      if (
        useEntry &&
        typeof useEntry === "object" &&
        typeof useEntry.loader === "string" &&
        useEntry.loader.includes("sass-loader")
      ) {
        useEntry.options = {
          ...(useEntry.options || {}),
          api: "modern",
          sassOptions: {
            ...((useEntry.options && useEntry.options.sassOptions) || {}),
            loadPaths: [
              path.resolve(__dirname),
              path.resolve(__dirname, "src"),
            ],
          },
        }
      }
    }
  }
}

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      webpackConfig.ignoreWarnings = [
        ...(webpackConfig.ignoreWarnings || []),
        (warning) =>
          typeof warning?.message === "string" &&
          warning.message.includes("Failed to parse source map"),
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

      patchSassLoader(webpackConfig.module?.rules)

      return webpackConfig
    },
  },
}