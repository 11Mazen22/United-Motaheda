const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function withHermescPatch(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.contents.includes('hermesCommand = new File')) {
      config.modResults.contents = config.modResults.contents.replace(
        /hermesCommand\s*=\s*new File.+?sdks\/hermesc.+/g,
        '// hermesCommand removed by withHermescPatch'
      );
    }
    return config;
  });
};
