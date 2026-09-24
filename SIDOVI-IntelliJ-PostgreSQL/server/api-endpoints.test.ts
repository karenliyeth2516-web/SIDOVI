import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import pg from "pg";

const { Pool } = pg;

const fakeRows = (sql: string) => {
  if (sql.includes("FROM vista_estadistica_postulaciones")) {
    return [{ periodo_id: 1, tipo_periodo: "MES", total_postulaciones: 3 }];
  }
  if (sql.includes("FROM vista_historial_aspirante")) {
    return [{ id_aspirante: 3, nombre_completo: "Juan Perez Garcia", total_postulaciones: 1 }];
  }
  if (sql.includes("FROM usuario")) {
    return [{ id_usuario: 1, nombre_completo: "Ana Lopez", correo: "ana1@gmail.com", contrasena_hash: "123", rol: "RRHH", activo: true }];
  }
  if (sql.includes("FROM postulacion p")) {
    return [{ id_postulacion: 1, id_vacante: 1, nombre_completo: "Juan Perez Garcia", nombre_cargo: "Guarda de Seguridad", estado: "EN_REVISION" }];
  }
  if (sql.includes("FROM vacante v")) {
    return [{ id_vacante: 1, titulo: "Guarda de Seguridad", nombre_cargo: "Guarda de Seguridad", requisitos: [] }];
  }
  return [];
};

vi.spyOn(Pool.prototype, "query").mockImplementation(async function (sql: string) {
  return { rows: fakeRows(sql), rowCount: fakeRows(sql).length } as never;
});

const { default: app } = await import("../server.js");
let server: ReturnType<typeof app.listen>;
let baseUrl = "";
let token = "";

describe("SIDOVI REST endpoints", () => {
  beforeAll(async () => {
    server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No se pudo abrir el servidor de pruebas");
    baseUrl = `http://127.0.0.1:${address.port}`;
    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ correo: "ana1@gmail.com", contrasena: "123" }),
    });
    expect(login.status).toBe(200);
    token = (await login.json()).token;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  });

  const authed = () => ({ headers: { Authorization: `Bearer ${token}` } });

  it("loads vacancies through the existing endpoint", async () => {
    const response = await fetch(`${baseUrl}/api/vacantes`, authed());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject([{ nombre_cargo: "Guarda de Seguridad" }]);
  });

  it("loads applications through the existing endpoint", async () => {
    const response = await fetch(`${baseUrl}/api/postulaciones`, authed());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject([{ id_vacante: 1, estado: "EN_REVISION" }]);
  });

  it("loads both Recursos Humanos reporting views", async () => {
    const response = await fetch(`${baseUrl}/api/reportes`, authed());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.estadisticas[0].tipo_periodo).toBe("MES");
    expect(body.historial[0].id_aspirante).toBe(3);
  });
});
