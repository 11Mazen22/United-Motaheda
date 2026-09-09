const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withFirebaseManifest(config) {
  return withAndroidManifest(config, async config => {
    const androidManifest = config.modResults;
    const application = androidManifest.manifest.application[0];
    
    // Ensure xmlns:tools is present
    androidManifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    
    if (application['meta-data']) {
      for (const metaData of application['meta-data']) {
        if (metaData.$['android:name'] === 'com.google.firebase.messaging.default_notification_color') {
          metaData.$['tools:replace'] = 'android:resource';
        }
      }
    }
    
    return config;
  });
};
