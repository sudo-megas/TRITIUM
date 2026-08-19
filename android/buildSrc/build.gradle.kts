plugins {
    `kotlin-dsl`
}

repositories {
    mavenCentral()
    google()
}

dependencies {
    testImplementation("junit:junit:4.13.2")
}

// Deliberately no AGP dependency here. buildSrc holds the two pieces that do
// not need one — the scanner, which is a pure function over a string, and the
// task type, which takes a file. The variant wiring that does need AGP lives in
// app/build.gradle.kts, where AGP is already on the classpath.
//
// The alternative was `implementation("com.android.tools.build:gradle")` plus a
// Plugin class. That works, but it puts the whole of AGP on the build-script
// classpath, couples buildSrc to an AGP version in a second place, and slows
// every configuration phase — all to move a few lines of wiring out of the file
// they apply to. (compileOnly is not an option: the class would compile and
// then fail at plugin-instantiation time with NoClassDefFoundError.)
//
// Adopted verbatim from the family's sibling Android port, sudo-megas/SAAT,
// which measured that failure mode before settling on this shape.

tasks.test {
    testLogging {
        events("failed")
    }
}

// Make the jar depend on the tests, so they actually run.
//
// Gradle builds only what it needs from buildSrc before evaluating the root
// project — that is `jar`, not `build` and not `test` — so hanging the tests
// off anything else means they never run on an ordinary invocation. Hanging
// them off `jar` (which Gradle must produce before it can evaluate
// app/build.gradle.kts, since that file imports VerifyManifestPolicyTask)
// restores the guarantee that the guardian's own tests run every time the
// guardian itself is used.
//
// finalizedBy rather than dependsOn: the `kotlin-dsl` plugin puts this jar on
// the test COMPILE classpath, so `jar dependsOn test` is a circular dependency
// (compileTestKotlin -> jar -> test -> compileTestKotlin). Finalizing runs the
// tests immediately after the jar instead of before it, and a failing finalizer
// still fails the build — which is the property that matters.
tasks.named("jar") {
    finalizedBy(tasks.test)
}
