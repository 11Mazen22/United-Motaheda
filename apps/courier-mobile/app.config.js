const baseConfig = require('./app.json');

module.exports = ({ config }) => ({
  ...baseConfig.expo,
  ...config,
  extra: {
    ...(baseConfig.expo.extra ?? {}),
    ...(config?.extra ?? {}),
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? config?.extra?.apiUrl,
  },
});
