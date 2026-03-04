// craco.config.js
const webpack = require("webpack");

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // ------------------------------------------------------------
      // 1) Stop source-map-loader from trying to read missing TS files
      //    inside node_modules (this causes the 600+ warnings)
      // ------------------------------------------------------------
      webpackConfig.module.rules = (webpackConfig.module.rules || []).map((rule) => {
        if (rule && rule.oneOf && Array.isArray(rule.oneOf)) {
          rule.oneOf = rule.oneOf.map((r) => {
            // CRA uses source-map-loader in some setups; if present, exclude node_modules
            if (
              r &&
              typeof r.loader === "string" &&
              r.loader.includes("source-map-loader")
            ) {
              return { ...r, exclude: /node_modules/ };
            }
            return r;
          });
        }
        return rule;
      });

      // ------------------------------------------------------------
      // 2) Webpack 5 Node core polyfills
      // ------------------------------------------------------------
      webpackConfig.resolve = webpackConfig.resolve || {};
      webpackConfig.resolve.fallback = {
        ...(webpackConfig.resolve.fallback || {}),
        crypto: require.resolve("crypto-browserify"),
        stream: require.resolve("stream-browserify"),
        vm: require.resolve("vm-browserify"),
        buffer: require.resolve("buffer/"),
        assert: require.resolve("assert/"),
        process: require.resolve("process/browser")
      };

      // This fixes axios "process/browser" resolution in strict ESM cases
      webpackConfig.resolve.alias = {
        ...(webpackConfig.resolve.alias || {}),
        "process/browser": require.resolve("process/browser.js")
      };

      // ------------------------------------------------------------
      // 3) Provide globals many libs expect
      // ------------------------------------------------------------
      webpackConfig.plugins = [
        ...(webpackConfig.plugins || []),
        new webpack.ProvidePlugin({
          process: "process/browser",
          Buffer: ["buffer", "Buffer"]
        })
      ];

      return webpackConfig;
    }
  }
};