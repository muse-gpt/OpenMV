//! Node-API surface for OpenMV.
//!
//! Thin binding only: song structure analysis lives upstream in
//! `media.audio::analysis`. The host passes a WAV path, this layer calls the
//! neutral entry and maps its JSON profile into JS values. Decoding, tempo
//! detection, beat phase and section segmentation are not re-implemented,
//! clamped or re-guessed here.
//!
//! The domain wire shape is Rust snake_case; this binding is the one place that
//! translates it to the camelCase keys the TypeScript authoring surface uses.

#![deny(missing_docs)]

use media_audio::analysis::analyze_wav;
use wae::{CallContext, Env, Error, JsValue, Result, function, register_module};

/// Library version used by `@wae/open-mv` to verify the native binary.
#[function]
fn version(ctx: CallContext) -> Result<JsValue> {
    ctx.env().string(env!("CARGO_PKG_VERSION"))
}

/// Analyzes a PCM WAV song and returns its structure profile.
///
/// Argument: `{ path: string }`. Missing files, non-WAV containers, unsupported
/// sample formats and audio shorter than one second reject with the stable
/// `invalid_input:` prefix from the domain error.
#[function(js_name = "analyzeWav")]
fn analyze_song(ctx: CallContext) -> Result<JsValue> {
    let argument = ctx
        .args()
        .first()
        .copied()
        .ok_or_else(|| Error::new("analyzeWav requires an options object"))?;
    let path = argument.get_named("path")?.as_string()?;
    let profile = analyze_wav(&path).map_err(map_domain_error)?;
    let value = serde_json::to_value(&profile)
        .map_err(|error| Error::new(format!("analyzeWav: cannot serialize the profile: {error}")))?;
    json_to_js(ctx.env(), &camel_keys(value))
}

/// Maps a `media.types` domain error onto a host error, keeping the stable code
/// (`invalid_input`, `io`, …) as the message prefix.
fn map_domain_error(error: media_types::Error) -> Error {
    Error::new(format!("{}: {error}", error.code()))
}

/// Rewrites every object key from the domain's snake_case to camelCase.
fn camel_keys(value: serde_json::Value) -> serde_json::Value {
    match value {
        serde_json::Value::Object(map) => serde_json::Value::Object(
            map.into_iter().map(|(key, inner)| (snake_to_camel(&key), camel_keys(inner))).collect(),
        ),
        serde_json::Value::Array(items) => serde_json::Value::Array(items.into_iter().map(camel_keys).collect()),
        other => other,
    }
}

fn snake_to_camel(key: &str) -> String {
    let mut out = String::with_capacity(key.len());
    let mut uppercase = false;
    for letter in key.chars() {
        if letter == '_' {
            uppercase = true;
        } else if uppercase {
            out.extend(letter.to_uppercase());
            uppercase = false;
        } else {
            out.push(letter);
        }
    }
    out
}

fn json_to_js(env: Env, value: &serde_json::Value) -> Result<JsValue> {
    match value {
        serde_json::Value::Null => env.null(),
        serde_json::Value::Bool(inner) => env.boolean(*inner),
        serde_json::Value::Number(number) => {
            if let Some(integer) = number.as_i64() {
                env.int64(integer)
            } else {
                env.double(number.as_f64().unwrap_or(0.0))
            }
        }
        serde_json::Value::String(text) => env.string(text),
        serde_json::Value::Array(items) => {
            let array = env.array_with_length(items.len())?;
            for (index, item) in items.iter().enumerate() {
                array.set_element(index as u32, json_to_js(env, item)?)?;
            }
            Ok(array)
        }
        serde_json::Value::Object(map) => {
            let object = env.object()?;
            for (key, item) in map {
                object.set_named(key, json_to_js(env, item)?)?;
            }
            Ok(object)
        }
    }
}

register_module![version, analyze_song];
