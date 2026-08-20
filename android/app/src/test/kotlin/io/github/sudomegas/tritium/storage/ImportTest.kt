package io.github.sudomegas.tritium.storage

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

/**
 * [VehicleRepository.importBundle], against hand-typed bundle text only —
 * never [Bundle.build]'s own output. F16's own `import.test.ts` never fed
 * the importer its own writer's output either: "a test that fed the
 * importer its own output would be proving the wrong thing." These
 * fixtures are typed the way a maker's editor — or the desktop's own
 * exporter, or another phone's — would produce them, matching F16 §2.2's
 * worked example.
 */
class ImportTest {

    @get:Rule
    val tmp = TemporaryFolder()

    private fun repository(): VehicleRepository = VehicleRepository(TritiumPaths(tmp.root))
    private fun paths(): TritiumPaths = TritiumPaths(tmp.root)

    private val newVehicleBundle = """
        format = "tritium-export"
        format_version = 1
        exported = 2026-08-19
        source = "android"

        [[vehicle]]
        slug = "sportage"
        name = "SPORTAGE 1.6 T-GDI"
        make = "Kia"
        model = "Sportage"
        year = 2025
        engine = "1.6 T-GDI"
        fuel_spec = "Kurşunsuz 95"
        plate = ""
        vin = ""
        tank_capacity_l = 54.0
        purchase_date = 2025-04-25
        purchase_price = 2160000.00
        registration_date = 2025-04-26
        inspection_due = 2027-04-01

        [[vehicle.fuel]]
        date = 2026-08-16
        odometer_km = 19764
        litres = 29.990
        price_per_litre = 73.380
        full_tank = true
        fuel_type = "Kurşunsuz 95"

        [[vehicle.costs]]
        date = 2026-04-11
        group = "tekrar-eden"
        category = "trafik-sigortasi"
        title = "Trafik Sigortası 26/27"
        amount = 11746.00
        income = false
        payment_method = "kredi-karti"
        bank = "Enpara"
        instalment = "Taksit 6"
        note = ""

        [[vehicle.service]]
        date = 2025-05-14
        part = "Michelin Primacy 4 S1 235/50R19 103V XL"
        odometer_km = 370
        amount = 8664.00
        vendor = "https://www.lastikcim.com.tr/"
    """.trimIndent()

    @Test
    fun `importing a bundle creates a new vehicle with fresh ids`() {
        val repository = repository()
        val result = repository.importBundle(newVehicleBundle)

        assertEquals(1, result.vehicles.size)
        val tally = result.vehicles.single()
        assertEquals("sportage", tally.slug)
        assertTrue(tally.vehicleCreated)
        assertEquals(Counts(1, 1, 1), tally.added)
        assertEquals(Counts(0, 0, 0), tally.skipped)

        val bundle = repository.loadVehicle("sportage")
        assertEquals("SPORTAGE 1.6 T-GDI", bundle.vehicle?.vehicle?.name)
        assertEquals("f-0001", bundle.fuel.entries.single().id)
        assertEquals("c-0001", bundle.costs.entries.single().id)
        assertEquals("s-0001", bundle.service.entries.single().id)
    }

    @Test
    fun `the created vehicle_toml never carries an inline fuel, costs, service or slug key`() {
        val repository = repository()
        repository.importBundle(newVehicleBundle)

        val text = paths().vehicleToml("sportage").readText()
        assertFalse(text.contains("fuel ="))
        assertFalse(text.contains("costs ="))
        assertFalse(text.contains("service ="))
        assertFalse(text.contains("slug"))
    }

    @Test
    fun `an existing vehicle's own vehicle_toml is left alone — a bundle only adds entries`() {
        val repository = repository()
        repository.saveVehicleRecord("sportage", VehicleDocument(1, EMPTY_VEHICLE.copy(name = "My Own Name"), emptyMap()))
        val before = paths().vehicleToml("sportage").readText()

        val tally = repository.importBundle(newVehicleBundle).vehicles.single()

        assertFalse(tally.vehicleCreated)
        assertEquals(before, paths().vehicleToml("sportage").readText())
        assertEquals("My Own Name", repository.loadVehicle("sportage").vehicle?.vehicle?.name)
        assertEquals(1, repository.loadVehicle("sportage").fuel.entries.size)
    }

    @Test
    fun `re-importing the same bundle adds nothing the second time — every file byte-identical`() {
        val repository = repository()
        repository.importBundle(newVehicleBundle)
        val fuelBefore = paths().fuelToml("sportage").readText()
        val costsBefore = paths().costsToml("sportage").readText()
        val serviceBefore = paths().serviceToml("sportage").readText()
        val vehicleBefore = paths().vehicleToml("sportage").readText()

        val tally = repository.importBundle(newVehicleBundle).vehicles.single()

        assertFalse(tally.vehicleCreated)
        assertEquals(Counts(0, 0, 0), tally.added)
        assertEquals(Counts(1, 1, 1), tally.skipped)
        assertEquals(fuelBefore, paths().fuelToml("sportage").readText())
        assertEquals(costsBefore, paths().costsToml("sportage").readText())
        assertEquals(serviceBefore, paths().serviceToml("sportage").readText())
        assertEquals(vehicleBefore, paths().vehicleToml("sportage").readText())
    }

    @Test
    fun `an id present in a bundle entry is ignored — the receiving file allocates its own`() {
        val repository = repository()
        val bundle = """
            format = "tritium-export"
            format_version = 1
            exported = 2026-08-19
            source = "android"

            [[vehicle]]
            slug = "spare"
            name = "Spare"

            [[vehicle.fuel]]
            id = "f-9999"
            date = 2026-01-01
            odometer_km = 100
            litres = 10.000
            price_per_litre = 40.000
            full_tank = true
        """.trimIndent()

        repository.importBundle(bundle)
        assertEquals("f-0001", repository.loadVehicle("spare").fuel.entries.single().id)
    }

    @Test
    fun `fuel dedup key is date plus odometer — two fill-ups same day, different reading, both import`() {
        val repository = repository()
        val bundle = """
            format = "tritium-export"
            format_version = 1
            exported = 2026-08-19
            source = "android"

            [[vehicle]]
            slug = "spare"
            name = "Spare"

            [[vehicle.fuel]]
            date = 2026-01-01
            odometer_km = 100
            litres = 10.000
            price_per_litre = 40.000
            full_tank = true

            [[vehicle.fuel]]
            date = 2026-01-01
            odometer_km = 150
            litres = 8.000
            price_per_litre = 40.000
            full_tank = true
        """.trimIndent()

        val tally = repository.importBundle(bundle).vehicles.single()
        assertEquals(2, tally.added.fuel)
        assertEquals(2, repository.loadVehicle("spare").fuel.entries.size)
    }

    @Test
    fun `service dedup key needs part — tyres and an oil change, same day and reading, both import`() {
        val repository = repository()
        val bundle = """
            format = "tritium-export"
            format_version = 1
            exported = 2026-08-19
            source = "android"

            [[vehicle]]
            slug = "spare"
            name = "Spare"

            [[vehicle.service]]
            date = 2026-01-01
            part = "Oil change"
            odometer_km = 500
            amount = 100.00
            vendor = ""

            [[vehicle.service]]
            date = 2026-01-01
            part = "Tyres"
            odometer_km = 500
            amount = 800.00
            vendor = ""
        """.trimIndent()

        val tally = repository.importBundle(bundle).vehicles.single()
        assertEquals(2, tally.added.service)
        assertEquals(2, repository.loadVehicle("spare").service.entries.size)
    }

    @Test
    fun `cost dedup key is date, category and amount — a different amount is a different bill`() {
        val repository = repository()
        val bundle = """
            format = "tritium-export"
            format_version = 1
            exported = 2026-08-19
            source = "android"

            [[vehicle]]
            slug = "spare"
            name = "Spare"

            [[vehicle.costs]]
            date = 2026-01-01
            group = "manual"
            category = "yikama"
            amount = 500.00
            income = false

            [[vehicle.costs]]
            date = 2026-01-01
            group = "manual"
            category = "yikama"
            amount = 600.00
            income = false
        """.trimIndent()

        val tally = repository.importBundle(bundle).vehicles.single()
        assertEquals(2, tally.added.costs)
    }

    @Test
    fun `a vehicle with no records at all is legal and imports with zero counts`() {
        val repository = repository()
        val bundle = """
            format = "tritium-export"
            format_version = 1
            exported = 2026-08-19
            source = "android"

            [[vehicle]]
            slug = "spare"
            name = "Spare"
        """.trimIndent()

        val tally = repository.importBundle(bundle).vehicles.single()
        assertTrue(tally.vehicleCreated)
        assertEquals(Counts(0, 0, 0), tally.added)
        assertEquals("Spare", repository.loadVehicle("spare").vehicle?.vehicle?.name)
    }

    @Test
    fun `refusing a bundle leaves every file on disk exactly as it was`() {
        val repository = repository()
        repository.importBundle(newVehicleBundle)
        val before = paths().fuelToml("sportage").readText()

        assertThrows(BundleError::class.java) {
            repository.importBundle("format = \"not-tritium\"\nformat_version = 1\n")
        }

        assertEquals(before, paths().fuelToml("sportage").readText())
    }

    @Test
    fun `a bundle from a newer format_version is refused, nothing written`() {
        val repository = repository()
        val bundle = """
            format = "tritium-export"
            format_version = 99
            exported = 2026-08-19
            source = "android"

            [[vehicle]]
            slug = "spare"
            name = "Spare"
        """.trimIndent()

        assertThrows(BundleError::class.java) { repository.importBundle(bundle) }
        assertEquals(emptyList<String>(), repository.listVehicleSlugs())
    }

    @Test
    fun `malformed TOML text is refused as unreadable, nothing written`() {
        val repository = repository()
        assertThrows(BundleError::class.java) { repository.importBundle("not valid [[[") }
        assertEquals(emptyList<String>(), repository.listVehicleSlugs())
    }

    @Test
    fun `a corrupt existing vehicle file aborts the whole import — nothing half-applied`() {
        val repository = repository()
        repository.saveVehicleRecord("first", VehicleDocument(1, EMPTY_VEHICLE.copy(name = "First"), emptyMap()))
        File(tmp.root, "vehicles/second").mkdirs()
        File(tmp.root, "vehicles/second/vehicle.toml").writeText("schema_version = 1\nname = \"Second\"\n")
        File(tmp.root, "vehicles/second/fuel.toml").writeText("not valid [[[")

        val bundle = """
            format = "tritium-export"
            format_version = 1
            exported = 2026-08-19
            source = "android"

            [[vehicle]]
            slug = "first"
            name = "First"

            [[vehicle.fuel]]
            date = 2026-01-01
            odometer_km = 100
            litres = 10.000
            price_per_litre = 40.000
            full_tank = true

            [[vehicle]]
            slug = "second"
            name = "Second"
        """.trimIndent()

        assertThrows(CorruptRecordException::class.java) { repository.importBundle(bundle) }

        // "first" sorts earlier in the bundle and would have gained an
        // entry — but the whole import aborts before any write happens.
        assertEquals(emptyList<FuelEntry>(), repository.loadVehicle("first").fuel.entries)
    }

    @Test
    fun `no backup round for a freshly created vehicle, nor for one entirely skip-wins-deduped`() {
        val repository = repository()
        assertFalse(paths().backupsDir.isDirectory)

        repository.importBundle(newVehicleBundle)
        assertFalse(paths().backupsDir.isDirectory)

        repository.importBundle(newVehicleBundle)
        assertFalse(paths().backupsDir.isDirectory)
    }

    @Test
    fun `a backup round is created for an existing vehicle that gains a genuinely new entry`() {
        val repository = repository()
        repository.importBundle(newVehicleBundle)
        assertFalse(paths().backupsDir.isDirectory)

        val secondBundle = """
            format = "tritium-export"
            format_version = 1
            exported = 2026-08-20
            source = "android"

            [[vehicle]]
            slug = "sportage"
            name = "SPORTAGE 1.6 T-GDI"

            [[vehicle.fuel]]
            date = 2026-09-01
            odometer_km = 20000
            litres = 30.000
            price_per_litre = 75.000
            full_tank = true
        """.trimIndent()

        repository.importBundle(secondBundle)
        assertTrue(paths().backupsDir.isDirectory)
    }
}
