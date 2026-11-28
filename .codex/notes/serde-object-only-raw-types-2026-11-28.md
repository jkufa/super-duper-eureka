# Serde: raw scenario types read from JSON objects only

- Serde's derived `Deserialize` for a struct accepts a JSON array of the fields in order as well as an object. There is no container attribute that turns the array form off.
- `crates/core/src/scenario/raw.rs` derives each raw type with `#[serde(remote = "Self")]`, which turns the derived reader into an inherent `Type::deserialize`, and implements the trait `Deserialize` by calling `deserialize_map` with a visitor that hands the map to that inherent reader through `MapAccessDeserializer`. `deserialize_map` rejects a sequence.
- Trap: the inherent `deserialize` that `remote = "Self"` generates takes the struct's visibility and shadows the trait method. On a `pub` type, `ScenarioFile::deserialize(json)` in another crate silently calls the array-accepting reader. So the nested raw types are `pub(super)`, and the two public ones, `ScenarioFile` and `VersionFile`, are `#[serde(transparent)]` wrappers around private field structs.
- To check a type is covered: drop `remote = "Self"` and its entries in the two macros, and `refuses_an_array_of_the_fields_in_place_of_each_object` names the edit that now deserialises.
