package io.github.sudomegas.tritium.storage

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class BundleTest {

    private val fullVehicle = VehicleBundle(
        slug = "sportage",
        vehicle = VehicleDocument(
            schemaVersion = 1,
            vehicle = Vehicle(
                name = "SPORTAGE 1.6 T-GDI",
                make = "Kia",
                model = "Sportage",
                year = 2025,
                engine = "1.6 T-GDI",
                fuelSpec = "Kurşunsuz 95",
                tankCapacityL = 540,
                purchaseDate = "2025-04-25",
                purchasePrice = 216000000,
                registrationDate = "2025-04-26",
                inspectionDue = "2027-04-01",
            ),
            rest = emptyMap(),
        ),
        fuel = EntryDocument(
            schemaVersion = 1,
            entries = listOf(
                FuelEntry(
                    id = "f-0001",
                    date = "2026-08-16",
                    odometerKm = 19764,
                    litres = 29990,
                    pricePerLitre = 73380,
                    fullTank = true,
                    fuelType = "Kurşunsuz 95",
                ),
            ),
            entryRest = emptyMap(),
            rest = emptyMap(),
        ),
        costs = EntryDocument(
            schemaVersion = 1,
            entries = listOf(
                CostEntry(
                    id = "c-0001",
                    date = "2026-04-11",
                    group = CostGroup.TEKRAR_EDEN,
                    category = "trafik-sigortasi",
                    title = "Trafik Sigortası 26/27",
                    amount = 1174600,
                    income = false,
                    paymentMethod = "kredi-karti",
                    bank = "Enpara",
                    instalment = "Taksit 6",
                ),
            ),
            entryRest = emptyMap(),
            rest = emptyMap(),
        ),
        service = EntryDocument(
            schemaVersion = 1,
            entries = listOf(
                ServiceEntry(
                    id = "s-0001",
                    date = "2025-05-14",
                    part = "Michelin Primacy 4 S1 235/50R19 103V XL",
                    odometerKm = 370,
                    amount = 866400,
                    vendor = "https://www.lastikcim.com.tr/",
                ),
            ),
            entryRest = emptyMap(),
            rest = emptyMap(),
        ),
    )

    private val emptyVehicle = VehicleBundle(
        slug = "spare",
        vehicle = VehicleDocument(1, Vehicle(name = "Spare"), emptyMap()),
        fuel = emptyFuel(),
        costs = emptyCosts(),
        service = emptyService(),
    )

    @Test
    fun `the envelope carries the exact keys F16 reads`() {
        val text = Bundle.build(listOf(fullVehicle), "2026-08-19")
        assertTrue(text.startsWith("format = \"tritium-export\"\nformat_version = 1\nexported = 2026-08-19\nsource = \"android\""))
    }

    @Test
    fun `no entry carries an id`() {
        val text = Bundle.build(listOf(fullVehicle), "2026-08-19")
        assertFalse(text.contains("id ="))
    }

    @Test
    fun `no total is ever written`() {
        val text = Bundle.build(listOf(fullVehicle), "2026-08-19")
        assertFalse(text.contains("total"))
    }

    @Test
    fun `figures are written as entered, not as scaled integers`() {
        val text = Bundle.build(listOf(fullVehicle), "2026-08-19")
        assertTrue(text.contains("litres = 29.990"))
        assertTrue(text.contains("price_per_litre = 73.380"))
        assertTrue(text.contains("amount = 11746.00"))
        assertTrue(text.contains("amount = 8664.00"))
        assertTrue(text.contains("tank_capacity_l = 54.0"))
        assertTrue(text.contains("purchase_price = 2160000.00"))
    }

    @Test
    fun `dates are bare, not quoted`() {
        val text = Bundle.build(listOf(fullVehicle), "2026-08-19")
        assertTrue(text.contains("date = 2026-08-16"))
        assertFalse(text.contains("date = \"2026-08-16\""))
    }

    @Test
    fun `the vehicle table carries slug, and no schema_version`() {
        val text = Bundle.build(listOf(fullVehicle), "2026-08-19")
        assertTrue(text.contains("[[vehicle]]\nslug = \"sportage\"\n"))
        assertFalse(text.contains("schema_version"))
    }

    @Test
    fun `a vehicle with no records exports with no entry blocks and no error`() {
        val text = Bundle.build(listOf(emptyVehicle), "2026-08-19")
        assertTrue(text.contains("[[vehicle]]\nslug = \"spare\"\n"))
        assertFalse(text.contains("[[vehicle.fuel]]"))
        assertFalse(text.contains("[[vehicle.costs]]"))
        assertFalse(text.contains("[[vehicle.service]]"))
    }

    @Test
    fun `multiple vehicles each get their own vehicle block`() {
        val text = Bundle.build(listOf(fullVehicle, emptyVehicle), "2026-08-19")
        assertEquals(2, Regex("\\[\\[vehicle\\]\\]").findAll(text).count())
    }

    @Test
    fun `a vehicle this build cannot parse is skipped, not fatal`() {
        val unreadable = fullVehicle.copy(vehicle = null)
        val text = Bundle.build(listOf(unreadable, emptyVehicle), "2026-08-19")
        assertEquals(1, Regex("\\[\\[vehicle\\]\\]").findAll(text).count())
        assertTrue(text.contains("slug = \"spare\""))
    }

    // -- AF9b: identity keys and Bundle.read's refusals -----------------

    @Test
    fun `fuelKey is date plus odometer only`() {
        val entry = fullVehicle.fuel.entries.first()
        assertEquals("2026-08-16|19764", fuelKey(entry))
    }

    @Test
    fun `serviceKey needs part too — tyres and an oil change, same day and reading, are two records`() {
        val entry = fullVehicle.service.entries.first()
        assertEquals("2025-05-14|370|Michelin Primacy 4 S1 235/50R19 103V XL", serviceKey(entry))
    }

    @Test
    fun `costKey carries no odometer — a bill is a sum, in a category, on a day`() {
        val entry = fullVehicle.costs.entries.first()
        assertEquals("2026-04-11|trafik-sigortasi|1174600", costKey(entry))
    }

    @Test
    fun `read accepts a well-formed envelope and returns the vehicle table`() {
        val text = Bundle.build(listOf(fullVehicle), "2026-08-19")
        val document = Bundle.read(text)
        assertEquals(1, asTableArray(document["vehicle"]).size)
    }

    @Test
    fun `read refuses a file with no tritium-export format key`() {
        val refusal = readRefusal("format = \"something-else\"\nformat_version = 1\n")
        assertTrue(refusal is BundleRefusal.NotABundle)
    }

    @Test
    fun `read refuses a format_version higher than this build understands`() {
        val refusal = readRefusal("format = \"tritium-export\"\nformat_version = 99\n")
        assertTrue(refusal is BundleRefusal.TooNew)
        val tooNew = refusal as BundleRefusal.TooNew
        assertEquals(99, tooNew.found)
        assertEquals(Bundle.FORMAT_VERSION, tooNew.understood)
    }

    @Test
    fun `read refuses text that is not valid TOML at all`() {
        val refusal = readRefusal("this is not = = toml [[[")
        assertTrue(refusal is BundleRefusal.Unreadable)
    }

    @Test
    fun `a missing format_version reads as 0 — never too-new`() {
        // A bundle from before this key existed is not from the future.
        val document = Bundle.read("format = \"tritium-export\"\n")
        assertEquals(0, asTableArray(document["vehicle"]).size)
    }

    private fun readRefusal(text: String): BundleRefusal {
        try {
            Bundle.read(text)
            fail("expected BundleError")
        } catch (e: BundleError) {
            return e.refusal
        }
        error("unreachable")
    }
}
