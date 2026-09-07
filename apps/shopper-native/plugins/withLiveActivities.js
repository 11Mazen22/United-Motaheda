/**
 * Expo Config Plugin for iOS Live Activities
 * 
 * This plugin modifies the iOS Info.plist to enable Live Activities
 * and adds the necessary entitlements for the Order Tracking Widget.
 */

const { withInfoPlist, withEntitlementsPlist, withPlugins } = require('expo/config-plugins');

/**
 * Enable Live Activities in Info.plist
 */
const withLiveActivitiesInfoPlist = (config) => {
  return withInfoPlist(config, (config) => {
    // Add NSSupportsLiveActivities key
    config.modResults.NSSupportsLiveActivities = true;
    
    // Add NSSupportsLiveActivitiesFrequentUpdates for frequent updates
    config.modResults.NSSupportsLiveActivitiesFrequentUpdates = true;
    
    // Add background modes for location updates
    if (!config.modResults.UIBackgroundModes) {
      config.modResults.UIBackgroundModes = [];
    }
    
    if (!config.modResults.UIBackgroundModes.includes('location')) {
      config.modResults.UIBackgroundModes.push('location');
    }
    
    if (!config.modResults.UIBackgroundModes.includes('fetch')) {
      config.modResults.UIBackgroundModes.push('fetch');
    }
    
    return config;
  });
};

/**
 * Add Live Activities Entitlements
 */
const withLiveActivitiesEntitlements = (config) => {
  return withEntitlementsPlist(config, (config) => {
    // Add com.apple.developer.live-activities entitlement
    config.modResults['com.apple.developer.live-activities'] = true;
    
    // Add com.apple.developer.live-activities-frequent-updates for frequent updates
    config.modResults['com.apple.developer.live-activities-frequent-updates'] = true;
    
    return config;
  });
};

/**
 * Main plugin that combines all modifications
 */
const withLiveActivities = (config) => {
  config = withLiveActivitiesInfoPlist(config);
  config = withLiveActivitiesEntitlements(config);
  return config;
};

module.exports = withLiveActivities;