# React Native core
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.systrace.** { *; }
-keep class com.facebook.debug.** { *; }

# React Native Reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.swmansion.gesture.** { *; }

# React Native Gesture Handler
-keep class com.swmansion.gesturehandler.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# React Native Screens
-keep class com.swmansion.rnscreens.** { *; }

# React Native Safe Area Context
-keep class com.th3rdwave.safearay.** { *; }

# Expo modules
-keep class expo.** { *; }
-keep class host.exp.exponent.** { *; }
-keep class expo.modules.** { *; }
-keep class expo.modules.updates.** { *; }
-keep class expo.modules.splashscreen.** { *; }
-keep class expo.modules.font.** { *; }
-keep class expo.modules.location.** { *; }
-keep class expo.modules.camera.** { *; }
-keep class expo.modules.imagepicker.** { *; }
-keep class expo.modules.notifications.** { *; }
-keep class expo.modules.securestore.** { *; }
-keep class expo.modules.filesystem.** { *; }
-keep class expo.modules.constants.** { *; }
-keep class expo.modules.device.** { *; }
-keep class expo.modules.haptics.** { *; }
-keep class expo.modules.linking.** { *; }
-keep class expo.modules.statusbar.** { *; }
-keep class expo.modules.taskmanager.** { *; }
-keep class expo.modules.updates.** { *; }

# Expo Router
-keep class expo.runtime.** { *; }
-keep class expo.router.** { *; }
-keep class expo.navigation.** { *; }

# Supabase
-keep class io.supabase.** { *; }
-keep class com.supabase.** { *; }

# React Navigation
-keep class com.swmansion.rnscreens.** { *; }
-keep class com.reactnativenavigation.** { *; }
-keep class com.reactnativenavigation.bridge.** { *; }
-keep class com.reactnativenavigation.events.** { *; }
-keep class com.reactnativenavigation.parse.** { *; }
-keep class com.reactnativenavigation.react.** { *; }
-keep class com.reactnativenavigation.stack.** { *; }
-keep class com.reactnativenavigation.tabs.** { *; }
-keep class com.reactnativenavigation.utils.** { *; }
-keep class com.reactnativenavigation.views.** { *; }
-keep class com.reactnativenavigation.widgets.** { *; }

# React Native Maps
-keep class com.airbnb.android.react.maps.** { *; }

# React Native MMKV
-keep class com.reactnativemmkv.** { *; }

# React Native WebView
-keep class com.reactnativecommunity.webview.** { *; }

# React Native Video
-keep class com.brentvatne.reactnativevideo.** { *; }

# React Native Blur
-keep class expo.modules.blur.** { *; }

# React Native Image
-keep class expo.modules.image.** { *; }

# React Native Linear Gradient
-keep class expo.modules.lineargradient.** { *; }

# Generic keep rules for reflection and serialization
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes SourceFile,LineNumberTable
-keep class * extends java.util.ArrayList { *; }
-keep class * extends java.util.HashMap { *; }

# Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep JavaScript interface classes
-keepclasseswithmembernames class * {
    @com.facebook.react.uimanager.annotations.ReactProp <methods>;
}
-keepclasseswithmembernames class * {
    @com.facebook.react.uimanager.annotations.ReactPropGroup <methods>;
}

# Keep custom views
-keep class * extends com.facebook.react.uimanager.ViewGroupManager { *; }
-keep class * extends com.facebook.react.uimanager.SimpleViewManager { *; }
-keep class * extends com.facebook.react.uimanager.LayoutShadowNode { *; }

# OkHttp and networking
-keep class okhttp3.** { *; }
-keep class okio.** { *; }
-dontwarn okhttp3.**
-dontwarn okio.**

# Gson / JSON
-keep class com.google.gson.** { *; }
-dontwarn com.google.gson.**

# Retrofit (if used transitively)
-keep class retrofit2.** { *; }
-dontwarn retrofit2.**

# General reflection safety
-keepclassmembers class * {
    @com.facebook.react.uimanager.annotations.ReactProp <fields>;
}
-keepclassmembers class * {
    @com.facebook.react.uimanager.annotations.ReactPropGroup <fields>;
}
