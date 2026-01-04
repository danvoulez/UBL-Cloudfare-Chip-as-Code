//! Pack Signer — Ed25519 + BLAKE3 para policy packs
//! Gera pack.json assinado a partir de YAML

use clap::{Arg, Command};
use ed25519_dalek::{SigningKey, VerifyingKey, pkcs8::DecodePrivateKey};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize)]
struct PolicyPack {
    id: String,
    version: String,
    blake3: String,
    signature: String, // Ed25519 signature (base64)
    created_at: u64,
}

fn main() -> anyhow::Result<()> {
    let matches = Command::new("pack-signer")
        .about("Sign policy YAML with Ed25519 + BLAKE3")
        .arg(
            Arg::new("yaml")
                .short('y')
                .long("yaml")
                .value_name("FILE")
                .help("Path to policy YAML file")
                .required(true),
        )
        .arg(
            Arg::new("key")
                .short('k')
                .long("key")
                .value_name("FILE")
                .help("Path to Ed25519 private key (PEM)")
                .required(false),
        )
        .arg(
            Arg::new("privkey_pem")
                .long("privkey_pem")
                .value_name("FILE")
                .help("Path to Ed25519 private key (PEM) - alias for --key")
                .required(false),
        )
        .arg(
            Arg::new("output")
                .short('o')
                .long("output")
                .long("out")
                .value_name("FILE")
                .help("Output pack.json path")
                .default_value("pack.json"),
        )
        .arg(
            Arg::new("id")
                .long("id")
                .value_name("ID")
                .help("Pack ID (default: auto-generated)")
                .required(false),
        )
        .arg(
            Arg::new("version")
                .long("version")
                .value_name("VERSION")
                .help("Pack version (default: 1.0)")
                .default_value("1.0"),
        )
        .get_matches();

    // Ler YAML
    let yaml_path = matches.get_one::<String>("yaml").unwrap();
    let yaml_content = fs::read_to_string(yaml_path)?;

    // Calcular BLAKE3
    let hash = blake3::hash(yaml_content.as_bytes());
    let blake3_hash = hex::encode(hash.as_bytes());

    // Carregar chave privada
    let key_path = matches.get_one::<String>("key")
        .or_else(|| matches.get_one::<String>("privkey_pem"))
        .ok_or_else(|| anyhow::anyhow!("--key or --privkey_pem required"))?;
    let key_pem = fs::read_to_string(key_path)?;
    let signing_key = SigningKey::from_pkcs8_pem(&key_pem)?;
    let verifying_key = VerifyingKey::from(&signing_key);

    // Criar mensagem para assinar (formato compatível com proxy/worker)
    let pack_id = matches.get_one::<String>("id")
        .map(|s| s.clone())
        .unwrap_or_else(|| format!("pack-{}", std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs()));
    let pack_version = matches.get_one::<String>("version").unwrap();
    let msg = format!("id={}\nversion={}\nblake3={}\n", pack_id, pack_version, blake3_hash);

    // Assinar
    let signature = signing_key.sign(msg.as_bytes());
    let signature_b64 = base64::engine::general_purpose::STANDARD.encode(signature.to_bytes());

    // Criar pack
    let pack = PolicyPack {
        id: pack_id,
        version: pack_version.clone(),
        blake3: blake3_hash,
        signature: signature_b64,
        created_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
    };

    // Salvar pack.json
    let output_path = matches.get_one::<String>("output").unwrap();
    fs::write(output_path, serde_json::to_string_pretty(&pack)?)?;

    // Mostrar chave pública (para copiar no wrangler.toml)
    let pubkey_pem = verifying_key.to_pkcs8_pem(ed25519_dalek::pkcs8::LineEnding::LF)?;
    let pubkey_b64 = base64::engine::general_purpose::STANDARD.encode(pubkey_pem.as_bytes());

    println!("✅ Pack criado: {}", output_path);
    println!("   ID: {}", pack.id);
    println!("   Version: {}", pack.version);
    println!("   BLAKE3: {}", pack.blake3);
    println!("   Signature: {}...", &pack.signature[..16]);
    println!();
    println!("📋 Public key (base64 PEM) para wrangler.toml:");
    println!("{}", pubkey_b64);

    Ok(())
}
