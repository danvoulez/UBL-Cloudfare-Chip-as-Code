    use axum::{routing::{get, post, any}, Router, extract::{State, Path, Request}, http::{HeaderMap, StatusCode, Method}, body::Bytes};
    use parking_lot::RwLock;
    use serde::{Deserialize, Serialize};
    use std::{sync::Arc, net::SocketAddr, fs, time::{SystemTime, UNIX_EPOCH}};
    use base64::{engine::general_purpose, Engine as _};
    use ed25519_dalek::{Signature, VerifyingKey, pkcs8::DecodePublicKey, Verifier};
    use blake3::Hasher;

    use policy_engine::{SemanticChip, RequestContext, decide};

    #[derive(Clone)]
    struct AppState {
        chip: Arc<RwLock<SemanticChip>>,
        pubkey_pem_b64: String,
        pack_json_path: String,
        policy_yaml_path: String,
        upstream_core: String,
        upstream_webhooks: String,
        panic_until: Arc<RwLock<i64>>,
        panic_reason: Arc<RwLock<String>>,
        allow_total: Arc<RwLock<u64>>,
        deny_total: Arc<RwLock<u64>>,
        eval_ms_sum: Arc<RwLock<f64>>,
        eval_ms_max: Arc<RwLock<f64>>,
        eval_count: Arc<RwLock<u64>>,
    }

    #[derive(Deserialize)]
    struct PanicReq { ttl_sec: i64, reason: String }

    #[tokio::main]
    async fn main() -> anyhow::Result<()> {
        // Blueprint 02: roteamento por prefixo
        let upstream_core = std::env::var("UPSTREAM_CORE").unwrap_or_else(|_| "http://127.0.0.1:9458".into());
        let upstream_webhooks = std::env::var("UPSTREAM_WEBHOOKS").unwrap_or_else(|_| "http://127.0.0.1:9460".into());
        let pubkey_pem_b64 = std::env::var("POLICY_PUBKEY_PEM_B64").expect("set POLICY_PUBKEY_PEM_B64");
        let policy_yaml_path = std::env::var("POLICY_YAML").unwrap_or("/etc/ubl/flagship/policy/ubl_core_v1.yaml".into());
        let pack_json_path = std::env::var("POLICY_PACK").unwrap_or("/etc/ubl/flagship/policy/pack.json".into());

        let chip = load_and_verify(&policy_yaml_path, &pack_json_path, &pubkey_pem_b64)?;

        let state = AppState{
            chip: Arc::new(RwLock::new(chip)),
            pubkey_pem_b64,
            pack_json_path,
            policy_yaml_path,
            upstream_core,
            upstream_webhooks,
            panic_until: Arc::new(RwLock::new(0)),
            panic_reason: Arc::new(RwLock::new(String::new())),
            allow_total: Arc::new(RwLock::new(0)),
            deny_total: Arc::new(RwLock::new(0)),
            eval_ms_sum: Arc::new(RwLock::new(0.0)),
            eval_ms_max: Arc::new(RwLock::new(0.0)),
            eval_count: Arc::new(RwLock::new(0)),
        };

        let app = Router::new()
            .route("/_reload", get(reload))
            .route("/__breakglass", post(panic_on))
            .route("/__breakglass/clear", post(panic_off))
            .route("/metrics", get(metrics))
            .route("/*path", axum::routing::MethodRouter::new()
            .get(forward)
            .post(forward)
            .put(forward)
            .delete(forward)
            .patch(forward)
            .head(forward))
            .with_state(state.clone());

        let addr: SocketAddr = "127.0.0.1:9456".parse().unwrap();
        println!("policy-proxy (rs) on {}", addr);
        axum::serve(tokio::net::TcpListener::bind(addr).await?, app).await?;
        Ok(())
    }

    fn load_and_verify(policy_yaml_path: &str, pack_json_path: &str, pubkey_pem_b64: &str) -> anyhow::Result<SemanticChip> {
        let yaml = fs::read_to_string(policy_yaml_path)?;
        let pack_raw = fs::read_to_string(pack_json_path)?;
        let pack: serde_json::Value = serde_json::from_str(&pack_raw)?;
        let msg = format!(
            "id={}\nversion={}\nblake3={}\n",
            pack.get("id").and_then(|v| v.as_str()).unwrap_or(""),
            pack.get("version").and_then(|v| v.as_str()).unwrap_or(""),
            pack.get("blake3").and_then(|v| v.as_str()).unwrap_or(""),
        );
        // Decodificar base64 para obter PEM (string)
        let pem_str = String::from_utf8(general_purpose::STANDARD.decode(pubkey_pem_b64)?)
            .map_err(|e| anyhow::anyhow!("invalid PEM base64: {}", e))?;
        
        // Extrair conteúdo base64 do PEM e decodificar para DER
        let pem_lines: Vec<&str> = pem_str.lines()
            .filter(|l| !l.starts_with("-----"))
            .collect();
        let pem_content: String = pem_lines.join("");
        let der_bytes = general_purpose::STANDARD.decode(pem_content)
            .map_err(|e| anyhow::anyhow!("failed to decode PEM content: {}", e))?;
        
        let vk = VerifyingKey::from_public_key_der(&der_bytes)?;
        let sig_b64 = pack.get("signature").and_then(|v| v.as_str()).ok_or(anyhow::anyhow!("signature missing"))?;
        let sig_bytes = general_purpose::STANDARD.decode(sig_b64)?;
        let sig_array: [u8; 64] = sig_bytes.try_into().map_err(|_| anyhow::anyhow!("invalid signature length"))?;
        let sig = Signature::from_bytes(&sig_array);
        vk.verify(msg.as_bytes(), &sig)?;

        // verify blake3
        let hash = blake3::hash(yaml.as_bytes());
        let digest = hex::encode(hash.as_bytes());
        if digest != pack.get("blake3").and_then(|v| v.as_str()).unwrap_or("") {
            return Err(anyhow::anyhow!("policy YAML does not match pack blake3"));
        }
        let chip = SemanticChip::from_yaml(&yaml)?;
        Ok(chip)
    }

    async fn reload(
        State(state): State<AppState>,
        axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
    ) -> Result<String, (StatusCode, String)> {
        // Blueprint 02: suporte a ?stage=next para shadow promotion
        let stage = params.get("stage").map(|s| s.as_str()).unwrap_or("active");
        let (yaml_path, pack_path) = if stage == "next" {
            // Tentar carregar pack.next.json e yaml.next.yaml
            let next_pack = state.pack_json_path.replace("pack.json", "pack.next.json");
            let next_yaml = state.policy_yaml_path.replace(".yaml", ".next.yaml").replace(".yml", ".next.yml");
            (next_yaml, next_pack)
        } else {
            (state.policy_yaml_path.clone(), state.pack_json_path.clone())
        };
        
        let chip = load_and_verify(&yaml_path, &pack_path, &state.pubkey_pem_b64)
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        *state.chip.write() = chip;
        Ok(format!(r#"{{"ok":true,"reloaded":true,"stage":"{}"}}"#, stage))
    }

    async fn panic_on(State(state): State<AppState>, axum::Json(p): axum::Json<PanicReq>) -> Result<String, (StatusCode, String)> {
        if p.ttl_sec <= 0 || p.reason.trim().is_empty() { return Err((StatusCode::BAD_REQUEST, "bad_request".into())); }
        let now = now_epoch();
        *state.panic_until.write() = now + p.ttl_sec;
        *state.panic_reason.write() = p.reason.clone();
        Ok(format!(r#"{{"ok":true,"until":{},"reason":"{}"}} "#, *state.panic_until.read(), p.reason))
    }

    async fn panic_off(State(state): State<AppState>) -> Result<String, (StatusCode, String)> {
        *state.panic_until.write() = 0;
        *state.panic_reason.write() = String::new();
        Ok("{\"ok\":true}".into())
    }

    async fn metrics(State(state): State<AppState>) -> String {
        let allow = *state.allow_total.read();
        let deny = *state.deny_total.read();
        let eval_sum = *state.eval_ms_sum.read();
        let eval_max = *state.eval_ms_max.read();
        let eval_cnt = *state.eval_count.read();
        let panic_active = if now_epoch() <= *state.panic_until.read() { 1 } else { 0 };
        format!(
            "policy_allow_total {}\npolicy_deny_total {}\npolicy_eval_ms_sum {:.3}\npolicy_eval_ms_max {:.3}\npolicy_eval_count {}\npanic_active {}\n",
            allow, deny, eval_sum, eval_max, eval_cnt, panic_active
        )
    }

    async fn forward(
        State(state): State<AppState>,
        Path(path): Path<String>,
        req: Request,
    ) -> Result<(StatusCode, HeaderMap, Bytes), (StatusCode, String)> {
        let (parts, body) = req.into_parts();
        let headers = parts.headers.clone();
        let method = parts.method.clone();
        let body_bytes = axum::body::to_bytes(body, usize::MAX).await
            .map_err(|e| (StatusCode::BAD_REQUEST, format!("body read error: {}", e)))?;
        let email = headers.get("CF-Access-Authenticated-User-Email").and_then(|v| v.to_str().ok()).unwrap_or("");
        let groups_hdr = headers.get("CF-Access-Groups").and_then(|v| v.to_str().ok()).unwrap_or("");
        let groups: Vec<String> = groups_hdr.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
        let panic_mode = now_epoch() <= *state.panic_until.read();

        let ctx = RequestContext {
            transport: policy_engine::TransportCtx { tls_version: 1.3 },
            mtls: policy_engine::MtlsCtx { verified: true, issuer: "UBL Local CA".into() },
            auth: policy_engine::AuthCtx { method: "access-passkey".into(), rp_id: "app.ubl.agency".into() },
            user: policy_engine::UserCtx { groups },
            system: policy_engine::SystemCtx { panic_mode },
            who: Some(email.to_string()),
            did: Some(format!("{} /{}", method, path)),
            req_id: headers.get("CF-Ray").and_then(|v| v.to_str().ok()).map(|s| s.to_string()),
            req: Some(policy_engine::ReqCtx {
                path: Some(format!("/{}", path)),
                method: Some(method.to_string()),
            }),
        };

        let start = std::time::Instant::now();
        let chip = state.chip.read().clone();
        let dec = decide(&chip, &ctx);
        let dt = start.elapsed().as_secs_f64()*1000.0;
        {
            *state.eval_ms_sum.write() += dt;
            if dt > *state.eval_ms_max.read() { *state.eval_ms_max.write() = dt; }
            *state.eval_count.write() += 1;
        }

        let hdr_out = HeaderMap::new();

        if dec.decision.starts_with("deny") {
            *state.deny_total.write() += 1;
            return Err((StatusCode::FORBIDDEN, "policy_denied".into()));
        } else {
            *state.allow_total.write() += 1;
        }

        // append minimal ledger line (local file)
        let when = now_rfc3339();
        let line = serde_json::json!({
            "who": ctx.who, "did": ctx.did, "when": when,
            "decision": dec.decision, "why": dec.why, "trigger": dec.trigger, "chain": dec.chain,
        }).to_string();
        let _ = append_ledger(&line);

        // forward upstream (Blueprint 02: roteamento por prefixo)
        let upstream = if path.starts_with("/core/") || path.starts_with("/admin/") || path.starts_with("/files/") {
            &state.upstream_core
        } else if path.starts_with("/webhooks/") {
            &state.upstream_webhooks
        } else {
            &state.upstream_core  // default
        };
        let url = format!("{}/{}", upstream.trim_end_matches('/'), path);
        let client = reqwest::Client::new();
        let mut fwd = client.request(method.clone(), &url);
        let mut pass = headers.clone();
        pass.insert("X-Auth-Method", axum::http::HeaderValue::from_static("access-passkey"));
        pass.insert("X-Auth-Rpid", axum::http::HeaderValue::from_static("app.ubl.agency"));
        // leave CF-* as-is; add condensed groups/email
        if let Some(w) = ctx.who.clone() {
            pass.insert("X-Who", axum::http::HeaderValue::from_str(&w).unwrap_or(axum::http::HeaderValue::from_static("")));
        }
        fwd = fwd.headers(pass).body(body_bytes);
        let resp = fwd.send().await.map_err(|e| (StatusCode::BAD_GATEWAY, e.to_string()))?;
        let status = StatusCode::from_u16(resp.status().as_u16()).unwrap();
        let bytes = resp.bytes().await.map_err(|e| (StatusCode::BAD_GATEWAY, e.to_string()))?;
        Ok((status, hdr_out, bytes))
    }

    fn append_ledger(line: &str) -> std::io::Result<()> {
        use std::io::Write;
        let mut obj: serde_json::Value = serde_json::from_str(line).unwrap_or(serde_json::json!({}));
        let canon = serde_json::to_string(&obj).unwrap_or_else(|_| line.to_string());
        let hash = blake3::hash(canon.as_bytes());
        let dig = hex::encode(hash.as_bytes());
        obj["hash"] = serde_json::Value::String(dig);
        let p = "/var/log/ubl/flagship-ledger.ndjson";
        // Criar diretório se não existir
        if let Some(parent) = std::path::Path::new(p).parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let mut f = std::fs::OpenOptions::new().create(true).append(true).open(p)?;
        writeln!(f, "{}", serde_json::to_string(&obj).unwrap())?;
        Ok(())
    }

    fn now_epoch() -> i64 {
        std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs() as i64
    }
    fn now_rfc3339() -> String {
        time::OffsetDateTime::now_utc().format(&time::format_description::well_known::Rfc3339).unwrap_or_else(|_| {
            chrono::Utc::now().to_rfc3339()
        })
    }
