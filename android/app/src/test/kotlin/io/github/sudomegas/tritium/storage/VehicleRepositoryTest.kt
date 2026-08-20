package io.github.sudomegas.tritium.storage

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class VehicleRepositoryTest {

    @get:Rule
    val tmp = TemporaryFolder()

    private fun repository(): VehicleRepository = VehicleRepository(TritiumPaths(tmp.root))

    @Test
    fun `listVehicleSlugs requires a vehicle_toml, not just a directory`() {
        val repository = repository()
        java.io.File(tmp.root, "vehicles/empty-dir").mkdirs()
        repository.saveVehicleRecord("kia", VehicleDocument(1, EMPTY_VEHICLE.copy(name = "Kia"), emptyMap()))

        assertEquals(listOf("kia"), repository.listVehicleSlugs())
    }

    @Test
    fun `vehicleNames maps a slug to its name, skipping one that will not parse`() {
        val repository = repository()
        repository.saveVehicleRecord("kia", VehicleDocument(1, EMPTY_VEHICLE.copy(name = "Kia Sportage"), emptyMap()))
        java.io.File(tmp.root, "vehicles/broken").mkdirs()
        java.io.File(tmp.root, "vehicles/broken/vehicle.toml").writeText("not valid [[[")

        val names = repository.vehicleNames()
        assertEquals("Kia Sportage", names["kia"])
        assertFalse("broken" in names)
    }

    @Test
    fun `loadVehicle reads whole files at once, empty ones as empty documents`() {
        val repository = repository()
        repository.saveVehicleRecord("kia", VehicleDocument(1, EMPTY_VEHICLE.copy(name = "Kia"), emptyMap()))

        val bundle = repository.loadVehicle("kia")
        assertEquals("Kia", bundle.vehicle?.vehicle?.name)
        assertEquals(emptyList<FuelEntry>(), bundle.fuel.entries)
    }

    @Test
    fun `loadVehicle propagates a corrupt record file rather than swallowing it`() {
        val repository = repository()
        java.io.File(tmp.root, "vehicles/kia").mkdirs()
        java.io.File(tmp.root, "vehicles/kia/fuel.toml").writeText("not valid [[[")

        assertThrows(CorruptRecordException::class.java) { repository.loadVehicle("kia") }
    }

    @Test
    fun `loadVehicleRecord reads only vehicle_toml, untroubled by a corrupt sibling`() {
        val repository = repository()
        repository.saveVehicleRecord("kia", VehicleDocument(1, EMPTY_VEHICLE.copy(name = "Kia"), emptyMap()))
        java.io.File(tmp.root, "vehicles/kia/fuel.toml").writeText("not valid [[[")

        assertEquals("Kia", repository.loadVehicleRecord("kia")?.vehicle?.name)
    }

    @Test
    fun `loadVehicleRecord is null, not thrown, for an absent or corrupt vehicle_toml`() {
        val repository = repository()
        assertNull(repository.loadVehicleRecord("absent"))

        java.io.File(tmp.root, "vehicles/broken").mkdirs()
        java.io.File(tmp.root, "vehicles/broken/vehicle.toml").writeText("not valid [[[")
        assertNull(repository.loadVehicleRecord("broken"))
    }

    @Test
    fun `addFuelEntry allocates the id and appends, without touching backups`() {
        val repository = repository()

        val added = repository.addFuelEntry("kia") { id -> FuelEntry(id = id, odometerKm = 100) }
        assertEquals("f-0001", added.id)
        assertEquals(listOf("f-0001"), repository.loadVehicle("kia").fuel.entries.map { it.id })
        assertFalse(TritiumPaths(tmp.root).backupsDir.isDirectory)
    }

    @Test
    fun `updateFuelEntry replaces in place and leaves a backup round first`() {
        val repository = repository()
        repository.addFuelEntry("kia") { id -> FuelEntry(id = id, odometerKm = 100) }

        val updated = repository.updateFuelEntry("kia", FuelEntry(id = "f-0001", odometerKm = 200))

        assertTrue(updated)
        assertEquals(200, repository.loadVehicle("kia").fuel.entries.single().odometerKm)
        assertTrue(TritiumPaths(tmp.root).backupsDir.isDirectory)
    }

    @Test
    fun `updating an id no longer present is a no-op, not an error — deleted by hand while a form was open`() {
        val repository = repository()
        repository.addFuelEntry("kia") { id -> FuelEntry(id = id) }

        val updated = repository.updateFuelEntry("kia", FuelEntry(id = "f-9999"))

        assertFalse(updated)
        assertEquals(1, repository.loadVehicle("kia").fuel.entries.size)
    }

    @Test
    fun `removeFuelEntry deletes by id, frees its number, and leaves a backup round first`() {
        val repository = repository()
        repository.addFuelEntry("kia") { id -> FuelEntry(id = id) }

        val removed = repository.removeFuelEntry("kia", "f-0001")

        assertTrue(removed)
        assertEquals(emptyList<FuelEntry>(), repository.loadVehicle("kia").fuel.entries)
        assertTrue(TritiumPaths(tmp.root).backupsDir.isDirectory)

        // Deleting the highest entry frees its number — issues.md I-07's answer.
        val next = repository.addFuelEntry("kia") { id -> FuelEntry(id = id) }
        assertEquals("f-0001", next.id)
    }

    @Test
    fun `addCostEntry and addServiceEntry allocate from their own kind's prefix`() {
        val repository = repository()
        val cost = repository.addCostEntry("kia") { id -> CostEntry(id = id) }
        val service = repository.addServiceEntry("kia") { id -> ServiceEntry(id = id) }

        assertEquals("c-0001", cost.id)
        assertEquals("s-0001", service.id)
    }

    @Test
    fun `uniqueSlugForNewVehicle resolves against the vehicles already on disk`() {
        val repository = repository()
        repository.saveVehicleRecord("kia-sportage", VehicleDocument(1, EMPTY_VEHICLE.copy(name = "Kia Sportage"), emptyMap()))

        assertEquals("kia-sportage-2", repository.uniqueSlugForNewVehicle("Kia Sportage"))
    }

    @Test
    fun `emptyBundle carries no vehicle record and no entries`() {
        val bundle = repository().emptyBundle("new-vehicle")
        assertNull(bundle.vehicle)
        assertEquals(emptyList<FuelEntry>(), bundle.fuel.entries)
        assertEquals(emptyList<CostEntry>(), bundle.costs.entries)
        assertEquals(emptyList<ServiceEntry>(), bundle.service.entries)
    }
}
