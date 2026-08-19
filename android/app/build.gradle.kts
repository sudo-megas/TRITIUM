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
        // when a version is actually TAGGED. AF1 is untagged (AF1.md §5), so
        // this stays 1 through every untagged milestone that follows it — the
        // same shape SAAT's own versionCode held at 1 through AM1..AM10, only
        // moving once AM11 became a real release.
        versionCode = 1
        versionName = "0.9"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    // No signingConfigs block. AF1.md §3 (SCOPE OUT): signing is AF10's, gated
    // on AF8's export path existing first. Every build here is unsigned.
    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
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
