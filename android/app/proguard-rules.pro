# ProGuard rules for Prompt Shorthand Analyzer V3.2
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keepclassmembers class com.sevenprojectchannel.promptshorthand.v32.** { *; }
