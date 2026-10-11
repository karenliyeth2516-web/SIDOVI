import { describe, expect, it } from "vitest";
import { createPostgresConfig } from "./postgres-config.js";

describe("PostgreSQL configuration", () => {
  it("prefers explicit local DB_* settings over a DATABASE_URL inherited from another environment", () => {
    expect(createPostgresConfig({
      DATABASE_URL: "postgres://remote.example/other_db",
      DB_HOST: "127.0.0.1",
      DB_PORT: "5433",
      DB_NAME: "sidovi_local",
      DB_USER: "postgres",
      DB_PASSWORD: "local-secret",
      PGSSL: "false",
    })).toEqual({
      host: "127.0.0.1",
      port: 5433,
      database: "sidovi_local",
      user: "postgres",
      password: "local-secret",
      ssl: false,
    });
  });

  it("uses DATABASE_URL when no explicit DB_* connection is configured", () => {
    expect(createPostgresConfig({
      DATABASE_URL: "postgres://remote.example/sidovi",
      PGSSL: "true",
    })).toEqual({
      connectionString: "postgres://remote.example/sidovi",
      ssl: { rejectUnauthorized: false },
    });
  });

  it("provides local defaults when no connection variables are configured", () => {
    expect(createPostgresConfig({})).toEqual({
      host: "localhost",
      port: 5432,
      database: "SIDOVI",
      user: "postgres",
      password: "",
      ssl: false,
    });
  });
});
