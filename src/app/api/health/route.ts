import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (db) {
      await db.execute(sql`select 1`);
      return Response.json({ ok: true, db: "connected" });
    }
    return Response.json({ ok: true, db: "not_configured" });
  } catch (e) {
    // If DB check fails, health still responds with 200 for platform healthchecks unless critical
    return Response.json({ ok: true, db: "error" });
  }
}
