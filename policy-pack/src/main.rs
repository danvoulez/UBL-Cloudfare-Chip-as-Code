//! Builder de pack.json — BLAKE3 + Ed25519

use clap::{Arg, Command};
use ed25519_dalek::{SigningKey, VerifyingKey};
use rand::rngs::OsRng;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize)]
struct PolicyPack {
    version: String,
    yaml_hash: String, // BLAKE3 do YAML
    signature: String, // Ed25519 assinatura do hash (base64)
    public_key: String, // Chave pública (base64)
    created_at: u64,
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let matches = Command::new("pack-builder")
        .about("Build policy pack.json with BLAKE3 + Ed25519 signature")
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
                .help("Path to Ed25519 private key (PEM or raw)")
                .required(false),
        )
        .arg(
            Arg::new("output")
                .short('o')
                .long("output")
                .value_name("FILE")
                .help("Output pack.json path")
                .default_value("pack.json"),
        )
        .arg(
            Arg::new("generate-key")
                .long("generate-key")
                .help("Generate new Ed25519 key pair")
                .action(clap::ArgAction::SetTrue),
        )
        .get_matches();

    // Gerar chave se solicitado
    if matches.get_flag("generate-key") {
        let signing_key = SigningKey::generate(&mut OsRng);
        let verifying_key = VerifyingKey::from(&signing_key);
        
        let key_dir = PathBuf::from("keys");
        fs::create_dir_all(&key_dir)?;
        
        use base64::{engine::general_purpose, Engine as _};
        
        fs::write(
            key_dir.join("private.pem"),
            format!("-----BEGIN PRIVATE KEY-----\n{}\n-----END PRIVATE KEY-----\n", 
                general_purpose::STANDARD.encode(signing_key.to_bytes())),
        )?;
        
        fs::write(
            key_dir.join("public.pem"),
            format!("-----BEGIN PUBLIC KEY-----\n{}\n-----END PUBLIC KEY-----\n",
                general_purpose::STANDARD.encode(verifying_key.to_bytes())),
        )?;
        
        println!("✅ Key pair generated in keys/");
        return Ok(());
    }

    // Ler YAML
    let yaml_path = matches.get_one::<String>("yaml").unwrap();
    let yaml_content = fs::read_to_string(yaml_path)?;

    // Calcular BLAKE3
    let hash = blake3::hash(yaml_content.as_bytes());
    let yaml_hash = hex::encode(hash.as_bytes());

    // Carregar ou gerar chave
    let signing_key = if let Some(key_path) = matches.get_one::<String>("key") {
        let key_bytes = fs::read(key_path)?;
        // Simplificado: assumindo formato PEM ou raw
        SigningKey::from_bytes(&key_bytes[..32].try_into().unwrap())
    } else {
        // Usar chave padrão (em produção, sempre passar)
        eprintln!("⚠️  No key provided, generating temporary key");
        SigningKey::generate(&mut OsRng)
    };

    let verifying_key = VerifyingKey::from(&signing_key);

    use base64::{engine::general_purpose, Engine as _};
    
    // Assinar hash
    let signature = signing_key.sign(yaml_hash.as_bytes());
    let signature_b64 = general_purpose::STANDARD.encode(signature.to_bytes());

    // Criar pack
    let pack = PolicyPack {
        version: "1.0".to_string(),
        yaml_hash,
        signature: signature_b64,
        public_key: general_purpose::STANDARD.encode(verifying_key.to_bytes()),
        created_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
    };

    // Salvar pack.json
    let output_path = matches.get_one::<String>("output").unwrap();
    fs::write(output_path, serde_json::to_string_pretty(&pack)?)?;

    println!("✅ Pack created: {}", output_path);
    println!("   Hash: {}", pack.yaml_hash);
    println!("   Public key: {}", pack.public_key);

    Ok(())
}
