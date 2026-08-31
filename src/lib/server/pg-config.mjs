import dns from "node:dns";

dns.setDefaultResultOrder("ipv4first");

export function cleanDatabaseUrl(raw) {
  let value = String(raw ?? "").trim().replace(/^\uFEFF/, "");
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }
  if (/^DATABASE_URL=/i.test(value)) value = value.slice("DATABASE_URL=".length).trim();
  return value;
}

export function normalizeDatabaseUrl(raw) {
  const cleaned = cleanDatabaseUrl(raw);
  let url;
  try {
    url = new URL(cleaned);
  } catch {
    throw new Error(
      "DATABASE_URL is not a valid Postgres URI. Paste the full URI from Supabase → Connect.",
    );
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("DATABASE_URL must start with postgresql://");
  }

  const host = url.hostname;
  const username = decodeURIComponent(url.username);
  const direct = host.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);
  if (direct && username.startsWith("postgres.")) {
    url.username = "postgres";
  }

  const pooler = /\.pooler\.supabase\.com$/i.test(host);
  if (pooler && (username === "postgres" || username === "")) {
    throw new Error(
      "DATABASE_URL points at the Supabase pooler, but the username is only `postgres`. Copy the pooler URI from Supabase → Connect so the username is postgres.<project-ref>.",
    );
  }

  if (!url.searchParams.get("sslmode")) url.searchParams.set("sslmode", "require");
  url.searchParams.set("gssencmode", "disable");
  return url.toString();
}

export function describeDatabaseTarget(raw) {
  try {
    const url = new URL(cleanDatabaseUrl(raw));
    return {
      user: decodeURIComponent(url.username) || "(none)",
      host: url.hostname,
      port: url.port || "5432",
      database: url.pathname.replace(/^\//, "").split("?")[0] || "postgres",
    };
  } catch {
    return null;
  }
}

function ssl() {
  return { rejectUnauthorized: false };
}

export function pgClientConfig(raw) {
  return {
    connectionString: normalizeDatabaseUrl(raw),
    ssl: ssl(),
    connectionTimeoutMillis: 20_000,
  };
}

export function pgPoolConfig(raw) {
  return {
    ...pgClientConfig(raw),
    max: 10,
    idleTimeoutMillis: 30_000,
  };
}

export function formatDatabaseError(err, raw) {
  const target = describeDatabaseTarget(raw);
  const message = String(err?.message ?? err);
  const lines = [];
  if (target) {
    lines.push(
      `Postgres target: user=${target.user} host=${target.host} port=${target.port} db=${target.database}`,
    );
  }
  if (/tenant\/user|not found/i.test(message) || err?.code === "XX000") {
    lines.push(
      "The Supabase pooler does not recognize this project. It is usually paused, deleted, or the URI host does not match the project (aws-0 vs aws-1, wrong region).",
      "Fix: open the Supabase project (restore it if paused) → Connect → copy the Transaction pooler URI (port 6543) → paste that entire string as DATABASE_URL in Render.",
    );
  }
  lines.push(message);
  return lines.join("\n");
}
