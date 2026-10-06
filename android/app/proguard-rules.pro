# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# ---------------------------------------------------------------------------
# Regras de keep para o R8 (minify + ofuscação). React Native, Hermes e os
# módulos Expo usam JNI/reflexão; sem estes keeps o app pode crashar no boot.
# A maioria já vem nas consumer-rules dos AARs, mas reforçamos o essencial.
# ---------------------------------------------------------------------------

# Anotações DoNotStrip/KeepGetters do React Native (JNI).
-keep,allowobfuscation @interface com.facebook.proguard.annotations.DoNotStrip
-keep,allowobfuscation @interface com.facebook.proguard.annotations.KeepGettersAndSetters
-keep @com.facebook.proguard.annotations.DoNotStrip class *
-keepclassmembers class * {
    @com.facebook.proguard.annotations.DoNotStrip *;
    @com.facebook.proguard.annotations.KeepGettersAndSetters *;
}

# Núcleo do React Native + Hermes + JNI.
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-dontwarn com.facebook.react.**
-dontwarn com.facebook.hermes.**

# Métodos nativos e construtores usados por reflexão nos módulos nativos.
-keepclassmembers class * {
    native <methods>;
}
-keepclassmembers class * {
    @com.facebook.react.bridge.ReactMethod <methods>;
}
-keepclassmembers class * {
    void set*(***);
    *** get*();
}

# Módulos Expo (expo-modules-core resolve definições por reflexão Kotlin).
-keep class expo.modules.** { *; }
-dontwarn expo.modules.**

# OpenIAP (compras in-app) — resolve tipos por reflexão/serialização.
-keep class io.github.hyochan.openiap.** { *; }
-keep class com.android.billingclient.** { *; }

# Kotlin metadata/coroutines (reflexão).
-keep class kotlin.Metadata { *; }
-keepclassmembers class **$WhenMappings { <fields>; }
-dontwarn kotlinx.**

# Add any project specific keep options here:
