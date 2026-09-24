import { afterAll, describe, expect, it } from "vitest";
import pg from "pg";

const { Pool } = pg;
const useExplicitPostgresConfig = Boolean(
  process.env.DB_HOST || process.env.DB_NAME || process.env.DB_USER || process.env.DB_PASSWORD,
);
const pool = new Pool(
  useExplicitPostgresConfig
    ? {
        host: process.env.DB_HOST || "localhost",
        port: Number(process.env.DB_PORT || 5432),
        database: process.env.DB_NAME || "sidovi_colviseg",
        user: process.env.DB_USER || "postgres",
        password: process.env.DB_PASSWORD || "1234",
        ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : false,
      }
    : {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : false,
      },
);

const hasExplicitPostgresConfig =
  process.env.SIDOVI_RUN_DB_TEST === "true" &&
  Boolean(process.env.DB_HOST && process.env.DB_NAME && process.env.DB_USER && process.env.DB_PASSWORD);

describe.skipIf(!hasExplicitPostgresConfig)("PostgreSQL connection", () => {

  it("answers a read-only health query", async () => {
    const result = await pool.query("SELECT NOW() AS fecha_servidor");
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.fecha_servidor).toBeInstanceOf(Date);
  });
});


describe.skipIf(!hasExplicitPostgresConfig)("PostgreSQL foreign keys", () => {

  it("accepts a valid cargo owner and rejects an unknown Recursos Humanos owner", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("CREATE TEMP TABLE rrhh_fk_fixture (id_rrhh INTEGER PRIMARY KEY)");
      await client.query("CREATE TEMP TABLE cargo_fk_fixture (id_cargo INTEGER PRIMARY KEY, id_rrhh INTEGER NOT NULL REFERENCES rrhh_fk_fixture(id_rrhh))");
      await client.query("INSERT INTO rrhh_fk_fixture (id_rrhh) VALUES (1)");
      await client.query("INSERT INTO cargo_fk_fixture (id_cargo, id_rrhh) VALUES (10, 1)");
      const linked = await client.query("SELECT c.id_cargo, r.id_rrhh FROM cargo_fk_fixture c JOIN rrhh_fk_fixture r ON r.id_rrhh = c.id_rrhh");
      expect(linked.rows).toEqual([{ id_cargo: 10, id_rrhh: 1 }]);
      await expect(client.query("INSERT INTO cargo_fk_fixture (id_cargo, id_rrhh) VALUES (11, 999)"))
        .rejects.toMatchObject({ code: "23503" });
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });
});


describe.skipIf(!hasExplicitPostgresConfig)("SIDOVI schema foreign keys", () => {

  it("joins real cargo rows to their sede and rejects an invalid owner", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const linked = await client.query(
        "SELECT c.id_cargo, c.id_sede FROM cargo c JOIN sede s ON s.id_sede = c.id_sede ORDER BY c.id_cargo LIMIT 1",
      );
      expect(linked.rowCount).toBeGreaterThan(0);
      await expect(
        client.query(
          "INSERT INTO cargo (nombre_cargo, descripcion_cargo, turnos, id_sede) VALUES ($1, $2, $3, $4)",
          [`__fk_test_${Date.now()}`, "rollback fixture", "Temporal", 2147483647],
        ),
      ).rejects.toMatchObject({ code: "23503" });
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });
});


afterAll(async () => {
  await pool.end();
});
