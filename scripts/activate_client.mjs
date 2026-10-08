import pg from "pg";
import { pgClientConfig } from "../src/lib/server/pg-config.mjs";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL is required. Load your environment before running this script.");
const client = new pg.Client(pgClientConfig(dbUrl));

const uuid = "5f702f64-101f-49b7-80a9-293ac93ebe70";

async function main() {
  await client.connect();
  console.log("Connected to database!");

  const userRes = await client.query("SELECT * FROM hud_users WHERE avatar_key = $1", [uuid]);
  if (userRes.rows.length === 0) {
    console.log(`User ${uuid} not found yet in hud_users.`);
  } else {
    console.log(`Found user: ${userRes.rows[0].avatar_name} (id: ${userRes.rows[0].id})`);
  }

  await client.query("UPDATE hud_users SET role = 'mom' WHERE avatar_key = $1", [uuid]);

  const updateRes = await client.query(`
    UPDATE pregnancies
    SET status = 'active',
        setup_complete = true,
        setup_step = 1,
        conceived_at = COALESCE(conceived_at, now() - interval '28 days'),
        updated_at = now()
    WHERE user_id = (SELECT id FROM hud_users WHERE avatar_key = $1)
      AND status IN ('trying', 'active')
    RETURNING id, status, setup_complete, conceived_at
  `, [uuid]);

  if (updateRes.rows.length > 0) {
    console.log("Updated pregnancy successfully:", updateRes.rows[0]);
  } else {
    console.log("No existing pregnancy row found to update. Attempting insert...");
    const insertRes = await client.query(`
      INSERT INTO pregnancies (user_id, partner_code, status, setup_complete, conceived_at)
      SELECT id, upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6)), 'active', true, now() - interval '28 days'
      FROM hud_users
      WHERE avatar_key = $1
      RETURNING id, status, setup_complete, conceived_at
    `, [uuid]);
    console.log("Inserted new pregnancy:", insertRes.rows);
  }

  await client.end();
  console.log("Done!");
}

main().catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});
