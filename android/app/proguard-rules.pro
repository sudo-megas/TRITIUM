# Empty by design. R8 is off for the release build in AF1 (isMinifyEnabled =
# false) because there is nothing to shrink yet and an unexplained
# shrinker-induced crash in a scaffold milestone would cost more than the few
# hundred kilobytes it saves. AF10 turns it on with the release build and adds
# whatever keep rules tomlkt's reflection needs.
