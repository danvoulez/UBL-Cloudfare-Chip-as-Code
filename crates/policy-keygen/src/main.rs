use anyhow::{Context, Result};
use clap::Parser;
use std::fs;
use std::path::PathBuf;
use std::os::unix::fs::PermissionsExt;
use rand::rngs::OsRng;
use ed25519_dalek::SigningKey;
use ed25519_dalek::pkcs8::{EncodePrivateKey, EncodePublicKey};
use base64::{engine::general_purpose, Engine as _};

#[derive(Parser, Debug)]
#[command(name="policy-keygen", about="Generate Ed25519 (PKCS#8 PEM) key pair for policy signing")]
struct Opts {
    /// Output directory (default: /etc/ubl/nova/keys)
    #[arg(long, default_value="/etc/ubl/nova/keys")]
    out_dir: PathBuf,
    /// File name stem (default: policy_signing)
    #[arg(long, default_value="policy_signing")]
    name: String,
    /// Print public PEM as base64 to stdout (useful for env vars)
    #[arg(long)]
    print_pub_b64: bool,
    /// Overwrite existing files
    #[arg(long)]
    overwrite: bool,
}

fn main() -> Result<()> {
    let opts = Opts::parse();
    fs::create_dir_all(&opts.out_dir).context("create out_dir")?;

    let priv_path = opts.out_dir.join(format!("{}_private.pem", opts.name));
    let pub_path  = opts.out_dir.join(format!("{}_public.pem",  opts.name));

    if !opts.overwrite {
        if priv_path.exists() || pub_path.exists() {
            anyhow::bail!("key files already exist; use --overwrite to replace");
        }
    }

    // Generate keypair
    let mut rng = OsRng;
    let sk = SigningKey::generate(&mut rng);
    let vk = sk.verifying_key();

    // Write PKCS#8 PEM (private) and SPKI PEM (public)
    // Converter para DER primeiro, depois para PEM
    let der_priv = sk.to_pkcs8_der().context("encode private DER")?;
    let der_pub = vk.to_public_key_der().context("encode public DER")?;
    
    // Converter DER para PEM (base64 + headers)
    let pem_priv = format!(
        "-----BEGIN PRIVATE KEY-----\n{}\n-----END PRIVATE KEY-----\n",
        general_purpose::STANDARD.encode(der_priv.as_bytes())
            .chars()
            .collect::<Vec<_>>()
            .chunks(64)
            .map(|c| c.iter().collect::<String>())
            .collect::<Vec<_>>()
            .join("\n")
    );
    let pem_pub = format!(
        "-----BEGIN PUBLIC KEY-----\n{}\n-----END PUBLIC KEY-----\n",
        general_purpose::STANDARD.encode(der_pub.as_bytes())
            .chars()
            .collect::<Vec<_>>()
            .chunks(64)
            .map(|c| c.iter().collect::<String>())
            .collect::<Vec<_>>()
            .join("\n")
    );

    fs::write(&priv_path, &pem_priv).context("write private key")?;
    fs::set_permissions(&priv_path, fs::Permissions::from_mode(0o600)).ok();
    fs::write(&pub_path, &pem_pub).context("write public key")?;

    // Optionally print base64 of public PEM (single line)
    if opts.print_pub_b64 {
        let b64 = general_purpose::STANDARD.encode(pem_pub.as_bytes());
        println!("{}", b64);
    } else {
        println!("keys written:");
        println!("  private: {}", priv_path.display());
        println!("  public : {}", pub_path.display());
    }

    Ok(())
}
