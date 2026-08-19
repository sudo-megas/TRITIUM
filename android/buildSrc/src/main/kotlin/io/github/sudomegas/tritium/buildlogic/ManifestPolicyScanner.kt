package io.github.sudomegas.tritium.buildlogic

import org.w3c.dom.Element
import org.w3c.dom.Node
import java.io.StringReader
import javax.xml.XMLConstants
import javax.xml.parsers.DocumentBuilderFactory
import org.xml.sax.InputSource

/** One reason a manifest violates XTRITIUM's rules. */
data class Violation(val rule: String, val detail: String)

/**
 * The logic behind the zero-permission guarantee, kept as a pure function over
 * a string so it can be unit-tested without Gradle, AGP or a device.
 *
 * XTRITIUM §3 principle 1: "Zero network. Ever." — stated for Android as the
 * merged manifest declaring no `<uses-permission>` at all. This is the
 * strongest privacy claim an Android app can make and it is verifiable by
 * anyone, so the check that guards it has to be right in ways that are easy to
 * get wrong. Adapted from the family's sibling Android port, sudo-megas/SAAT,
 * whose own version of this scanner is what caught a real dependency injecting
 * four permissions transitively before this project ever needed to worry.
 */
object ManifestPolicyScanner {

    /**
     * Every element name that requests or defines a permission.
     *
     * `uses-permission-sdk-23` matters and is the one a naive check misses. It
     * is a genuine permission request, merely gated to API 23 and above, and it
     * is exactly what a dependency would use to slip one past a guardian that
     * only looks for `uses-permission`.
     */
    private val permissionElements = setOf(
        "uses-permission",
        "uses-permission-sdk-23",
        "permission",
        "permission-tree",
        "permission-group",
    )

    fun scan(xml: String): List<Violation> {
        val doc = DocumentBuilderFactory.newInstance().apply {
            isNamespaceAware = true
            isExpandEntityReferences = false
            setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true)
            setFeature("http://apache.org/xml/features/disallow-doctype-decl", true)
        }.newDocumentBuilder().parse(InputSource(StringReader(xml)))

        val violations = mutableListOf<Violation>()
        val elements = mutableListOf<Element>()
        collectElements(doc.documentElement, elements)

        elements.forEach { element ->
            // Match on the element's LOCAL NAME, ignoring any namespace prefix.
            //
            // The alternative — searching the manifest text for the substring
            // "permission" — matches android:grantUriPermissions and similar
            // attributes that are not a permission request at all. A
            // grep-based guardian would go red for entirely the wrong reason
            // the day this app ever grants a URI, and the obvious fix would be
            // to weaken the guardian, which is the worst possible outcome for
            // the rule it protects.
            val name = element.localName ?: element.nodeName.substringAfterLast(':')
            if (name in permissionElements) {
                val declared = element.getAttributeNode("android:name")?.value
                    ?: element.getAttributeNS(ANDROID_NS, "name").takeIf { it.isNotEmpty() }
                    ?: "(unnamed)"
                violations += Violation(
                    rule = "XTRITIUM §3 principle 1 (zero network — zero permissions)",
                    detail = "<$name> declares $declared",
                )
            }

            if (name == "activity") {
                val configChanges = element.getAttributeNode("android:configChanges")?.value
                    ?: element.getAttributeNS(ANDROID_NS, "configChanges").takeIf { it.isNotEmpty() }
                if (configChanges != null) {
                    // Suppressing recreation is how a rotation bug gets "fixed"
                    // without being fixed, and this app's Compose state is
                    // expected to survive rotation through genuine recreation.
                    violations += Violation(
                        rule = "rotation survival must be real, not suppressed",
                        detail = "<activity> sets android:configChanges=\"$configChanges\"",
                    )
                }
            }

            if (name == "uses-feature") {
                val required = element.getAttributeNode("android:required")?.value
                    ?: element.getAttributeNS(ANDROID_NS, "required").takeIf { it.isNotEmpty() }
                if (required == null || required == "true") {
                    violations += Violation(
                        rule = "install compatibility",
                        detail = "<uses-feature> is required=true, narrowing which devices may install",
                    )
                }
            }
        }

        return violations
    }

    private fun collectElements(node: Node, into: MutableList<Element>) {
        if (node.nodeType == Node.ELEMENT_NODE) into += node as Element
        val children = node.childNodes
        for (i in 0 until children.length) collectElements(children.item(i), into)
    }

    private const val ANDROID_NS = "http://schemas.android.com/apk/res/android"
}
