import com.android.build.api.artifact.SingleArtifact
import io.github.sudomegas.tritium.buildlogic.VerifyManifestPolicyTask

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.compose.compiler)
    alias(libs.plugins.kotlin.serialization)
}

android {
    // Permanent once distributed (AF1.md §2.1 decision 2) — confirmed with the
    // maker before this file existed, and matched deliberately to the family's
    // sibling Android port (sudo-megas/SAAT) rather than to the desktop's own
    // bare `tritium` appId (electron-builder.yml), which never had to survive
    // a store or a device's own update check.
    namespace = "io.github.sudomegas.tritium"
    compileSdk = 37

    defaultConfig {
        applicationId = "io.github.sudomegas.tritium"
        minSdk = 26
        targetSdk = 37

        // XTRITIUM §9.1's resolved scheme: versionName tracks the AF-milestone
        // number as a decimal, versionCode is a monotonic integer bumped only
        // when a version is actually TAGGED. AF1..AF9b were untagged, so this
        // held at 1 through all of them — the same shape SAAT's own versionCode
        // held at 1 through AM1..AM10. AF11 was the first tagged release
        // ("1.0", AF1.md's own decision table). AF12's audit found real
        // findings and fixed all of them (build/docs/AF12.md), moving this to
        // "1.1". "1.2" carried two maker-requested fixes with no AF doc of
        // their own — the real launcher icon (build/icons/ finally reaching
        // Android) and AF1.md §2.1 decision 7's placeholder window background.
        // "1.3" tried the wrong fix for 1.2's own launcher icon regression:
        // it added legacy mipmap-<density>/ic_launcher(_round).png fallbacks,
        // reasoning some OEM launchers (reported: Honor/MagicOS) don't render
        // adaptive-icon-only apps. Confirmed on the reporting device
        // (Honor 200 Ultra, MagicOS 10 / Android 16) that this did not fix
        // it — expected in hindsight, since mipmap-anydpi-v26 always outranks
        // density-only buckets on API 26+, so a broken adaptive icon never
        // even reaches the fallback. This move to "1.4" is the real fix:
        // ic_launcher_background.png had a rounded-square mask baked into
        // its own alpha channel (fully transparent corners), which violates
        // the adaptive-icon spec's requirement that the background layer be
        // fully opaque — the system, not the app, is supposed to apply the
        // mask shape. That is the one documented spec violation in these
        // assets, and the one whose failure mode (PackageManager silently
        // substituting the default icon, in both Settings and the launcher)
        // matches what was reported. The corners are now filled with the
        // artwork's own border colour instead of left transparent — visually
        // identical, but opaque, letting the OS apply its own mask again.
        // Confirmed on the same device: fixed the launcher's blank LABEL
        // (TRITIUM now sorts and shows correctly), but the icon itself was
        // still Android's system default, so 1.4 was a real fix for a real
        // spec violation and NOT the cause of the reported bug. This move to
        // "1.5" is the remaining source-level hypothesis, not a confirmed
        // fix: ic_launcher_foreground.xml has been a content-less <vector>
        // (zero <path> elements) since 1.2, unchanged across every attempt
        // so far. AOSP's own AdaptiveIconDrawable.inflate() has no path-count
        // check and renders it fine — but that only speaks to stock Android,
        // not to whatever MagicOS's own icon compositor does with the
        // foreground layer (shadow/effect generation, bounds analysis, etc.
        // are plausibly OEM additions, not AOSP). Replaced the path-less
        // vector with one real, fully transparent (alpha 0) path covering
        // the full canvas — same net visual result, nothing drawn — so a
        // renderer that mishandles literally zero drawing commands now gets
        // real (if invisible) content instead.
        versionCode = 7
        versionName = "1.5"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    /**
     * Release signing — AF11.md §1.
     *
     * NOTHING SECRET IS IN THIS REPOSITORY, and nothing ever may be. The
     * keystore reaches a build through Gradle properties in
     * `~/.gradle/gradle.properties`, outside the tree — mirrors the sibling
     * Android port's own established convention (sudo-megas/SAAT,
     * `releaseKeystore(project)`), renamed for this app. `android/.gitignore`
     * has carried `*.keystore`, `*.jks` and `keystore.properties` since AF1,
     * before any keystore existed to be careless with.
     *
     * CI never holds this key at all (XTRITIUM §9.3 — no signing key is ever
     * stored on a server): `android-release.yml` builds an UNSIGNED release
     * APK and stops there. Signing happens once, locally, on the maker's own
     * machine, exactly as the desktop's own `package.yml` leaves its own
     * signature step to the maker.
     *
     * CONFIGURED ONLY WHEN THE MATERIAL IS ACTUALLY THERE, so `assembleDebug`,
     * the unit tests and `check` all keep working on a machine — including
     * every CI run — that has never seen the keystore. An always-present
     * signing config would fail configuration for all of them.
     */
    val keystore = releaseKeystore(project)
    if (keystore != null) {
        signingConfigs {
            create("release") {
                storeFile = keystore.file
                storePassword = keystore.storePassword
                keyAlias = keystore.keyAlias
                keyPassword = keystore.keyPassword
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
            // Null when no keystore was supplied, which AGP reads as "do not
            // sign" rather than as an error — see above.
            signingConfig = signingConfigs.findByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
        // For About's version line (AF1.md §2.1 decision 8). Generating one
        // constant is cheaper than reading the version back through
        // PackageManager at runtime, and AGP 9 defaults this off.
        buildConfig = true
    }

    testOptions {
        unitTests {
            isReturnDefaultValues = true
        }
    }
}

/**
 * The guardian of XTRITIUM §3 principle 1 ("Zero network. Ever."), at the
 * strongest level Android can state it: no `<uses-permission>` anywhere in the
 * MERGED manifest. Registered once per variant.
 *
 * A Gradle task rather than a unit test for a structural reason: `testBuildType`
 * defaults to debug, and AGP 9 makes it explicit — the release unit-test
 * variant is not even created. A Robolectric test could therefore only ever see
 * the debug manifest, forever, while release is exactly where a
 * dependency-injected permission would actually ship.
 *
 * `onVariants` with no selector fires for debug AND release, and reading
 * MERGED_MANIFEST carries the task dependency automatically — so `./gradlew
 * check` verifies the release manifest without assembling a release APK.
 * Adapted directly from the family's sibling Android port (sudo-megas/SAAT),
 * whose own version of this guardian caught a real dependency injecting four
 * permissions transitively before this pattern was trusted here.
 */
androidComponents {
    onVariants { variant ->
        val capitalised = variant.name.replaceFirstChar { it.uppercase() }
        val verify = tasks.register<VerifyManifestPolicyTask>(
            "verify${capitalised}ManifestPolicy"
        ) {
            group = "verification"
            description = "Asserts the merged ${variant.name} manifest declares no permissions."

            // A read, not a transform: this observes the merger's output and
            // can never alter it. The only way it affects the build is by
            // failing.
            mergedManifest.set(variant.artifacts.get(SingleArtifact.MERGED_MANIFEST))
            variantName.set(variant.name)
            mergerReport.set(
                layout.buildDirectory.file(
                    "outputs/logs/manifest-merger-${variant.name}-report.txt"
                )
            )
            report.set(
                layout.buildDirectory.file("reports/manifest-policy/${variant.name}.txt")
            )
        }
        tasks.named("check") { dependsOn(verify) }
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)

    // AppCompat, not a convenience — AF1.md §2.1 decision 3. XTRITIUM §3
    // principle 6 forbids reading the system locale, which is not a default on
    // Android: resource resolution follows the system locale the moment
    // values-tr/ exists. The supported way to hold an explicit per-app locale
    // across the whole minSdk 26 range is AppCompatDelegate.setApplicationLocales,
    // which needs this library and determines the Activity base class and XML
    // theme parent — both expensive to change once every screen exists.
    implementation(libs.androidx.appcompat)

    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.navigation.compose)

    val composeBom = platform(libs.compose.bom)
    implementation(composeBom)
    implementation(libs.compose.ui)
    implementation(libs.compose.ui.graphics)
    implementation(libs.compose.material3)
    debugImplementation(libs.compose.ui.tooling)
    implementation(libs.compose.ui.tooling.preview)

    // TOML, chosen now while settings.toml is its only consumer (AF1.md §2.1
    // decision 4) — adopted directly from sudo-megas/SAAT, which already
    // measured it against a real fixture rather than re-running that
    // evaluation here.
    implementation(libs.tomlkt)

    testImplementation(libs.junit)

    androidTestImplementation(libs.androidx.test.ext.junit)
    androidTestImplementation(libs.androidx.test.espresso.core)
    androidTestImplementation(composeBom)
    androidTestImplementation(libs.compose.ui.test.junit4)
    debugImplementation(libs.compose.ui.test.manifest)
}

/**
 * Where the release signing material comes from — AF11.md §1.
 *
 * Gradle properties only, and never the repository: `~/.gradle/gradle.properties`
 * is outside the tree and is not backed up into it. That is how the maker signs
 * a build by hand, on the machine that holds `tritium-release.jks`.
 *
 * Returns null when the material is absent or the file it names does not exist,
 * so an ordinary build — including every CI run, which never has this file —
 * simply produces an unsigned release APK. A missing keystore is not an error
 * here; shipping one that is not signed is, and that is the maker's own local
 * verification step to catch before a signed APK ever reaches a release page.
 */
data class ReleaseKeystore(
    val file: File,
    val storePassword: String,
    val keyAlias: String,
    val keyPassword: String,
)

fun releaseKeystore(project: Project): ReleaseKeystore? {
    fun value(name: String): String? =
        (System.getenv(name) ?: project.findProperty(name)?.toString())
            ?.takeIf { it.isNotBlank() }

    val path = value("TRITIUM_KEYSTORE_FILE") ?: return null
    val file = File(path)
    if (!file.isFile) {
        project.logger.lifecycle(
            "TRITIUM_KEYSTORE_FILE is set to $path but no file is there — " +
                "building the release variant UNSIGNED."
        )
        return null
    }

    val missing = listOf(
        "TRITIUM_KEYSTORE_PASSWORD", "TRITIUM_KEY_ALIAS", "TRITIUM_KEY_PASSWORD",
    ).filter { value(it) == null }

    if (missing.isNotEmpty()) {
        project.logger.lifecycle(
            "TRITIUM_KEYSTORE_FILE is set but $missing " +
                "${if (missing.size == 1) "is" else "are"} not — " +
                "building the release variant UNSIGNED."
        )
        return null
    }

    return ReleaseKeystore(
        file = file,
        storePassword = value("TRITIUM_KEYSTORE_PASSWORD")!!,
        keyAlias = value("TRITIUM_KEY_ALIAS")!!,
        keyPassword = value("TRITIUM_KEY_PASSWORD")!!,
    )
}
