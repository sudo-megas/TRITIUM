// The record shapes of XTRITIUM §4.4, verbatim — plus the schema_version line
// §4.2 requires and §4.4's entry samples elide.
//
// These are the fixtures the serialisers are held to, character for character.
// They live in one file so that a change to the constitution is a change in one
// place here, and so no test can quietly drift its own copy to match the code.

export const FUEL_SAMPLE = `schema_version = 1

[[entry]]
id = "f-0001"
date = 2026-08-16
odometer_km = 19764
litres = 29.990
price_per_litre = 73.380
full_tank = true
fuel_type = "Kurşunsuz 95"
`

export const COSTS_SAMPLE = `schema_version = 1

[[entry]]
id = "c-0001"
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
`

export const SERVICE_SAMPLE = `schema_version = 1

[[entry]]
id = "s-0001"
date = 2025-05-14
part = "Michelin Primacy 4 S1 235/50R19 103V XL"
odometer_km = 370
amount = 8664.00
vendor = "https://www.lastikcim.com.tr/"
`

export const VEHICLE_SAMPLE = `schema_version = 1
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
`
