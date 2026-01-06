import { z } from "zod";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { request } from "undici";

// Lazy import para evitar erro se SDK não estiver instalado ainda
async function getMcp() {
  return await import("@modelcontextprotocol/sdk/client");
}

const env = (k: string, d?: string) => process.env[k] ?? d ?? "";

const ServerSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  transports: z.array(z.object({
    type: z.enum(["streamable-http", "ws", "sse"]).default("streamable-http"),
    url: z.string().url()
  })),
  oauth: z.object({ issuer: z.string().optional() }).optional(),
  tags: z.array(z.string()).optional()
});
const RegistrySchema = z.object({ servers: z.array(ServerSchema) });

async function fetchServers(url: string) {
  const res = await request(url);
  if (res.statusCode >= 400) throw new Error(`Registry fetch failed ${res.statusCode}`);
  const data = await res.body.json();
  const parsed = RegistrySchema.safeParse(data);
  if (parsed.success) return parsed.data.servers;
  if (Array.isArray(data)) return data; // fallback
  throw new Error("Invalid registry format");
}

async function menu(servers: any[]) {
  console.log("\n📋 Available MCP Servers (Office Palette):\n");
  servers.forEach((s, i) => {
    const tags = (s.tags || []).join(', ');
    const desc = s.description ? ` — ${s.description.substring(0, 60)}...` : '';
    console.log(`${i + 1}. ${s.name}${desc}`);
    if (tags) console.log(`   Tags: ${tags}`);
  });
  const rl = readline.createInterface({ input, output });
  const choice = Number(await rl.question("\nPick a server (number): ")) - 1;
  rl.close();
  return servers[choice];
}

async function main() {
  const upstream = env("REGISTRY_URL", "https://registry.modelcontextprotocol.io");
  const sub = env("SUBREGISTRY_URL");
  const lists: any[] = [];
  try { 
    console.log("📡 Fetching upstream registry...");
    lists.push(...await fetchServers(upstream)); 
  } catch (e) {
    console.warn("⚠️  Upstream registry unavailable:", e);
  }
  if (sub) { 
    try { 
      console.log("📡 Fetching sub-registry...");
      lists.push(...await fetchServers(sub)); 
    } catch (e) {
      console.warn("⚠️  Sub-registry unavailable:", e);
    }
  }
  if (!lists.length) throw new Error("No servers available");
  
  const pick = await menu(lists);
  if (!pick) {
    console.error("Invalid selection");
    process.exit(1);
  }

  const t = pick.transports[0];
  console.log(`\n🔌 Connecting to ${pick.name} via ${t.type} → ${t.url}`);

  const { McpClient } = await getMcp();
  const client = new McpClient({ name: "office-client", version: "0.1.0" });
  await client.connect(t.url, { transport: t.type as any });
  console.log("✅ Connected. Listing tools...\n");

  const tools = await client.listTools();
  for (const tool of tools) {
    console.log(`  • ${tool.name} — ${tool.description ?? ''}`);
  }

  const ping = tools.find((t: any) => t.name === "ping");
  if (ping) {
    const res = await client.callTool("ping", { message: "hello from office client"});
    console.log("\n📤 Ping →", res);
  }

  await client.disconnect();
  console.log("\n👋 Disconnected");
}

main().catch(err => { 
  console.error("❌ Error:", err); 
  process.exit(1); 
});
