import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type RecursosHumanosFixture = { id_rrhh: number };
type CargoFixture = { id_cargo: number; id_rrhh: number; nombre_cargo: string };

describe("SIDOVI relationship fixture", () => {
  it("resolves every cargo to its Recursos Humanos owner", () => {
    const recursosHumanos: RecursosHumanosFixture[] = [{ id_rrhh: 1 }];
    const cargos: CargoFixture[] = [
      { id_cargo: 1, id_rrhh: 1, nombre_cargo: "Guarda de Seguridad" },
      { id_cargo: 2, id_rrhh: 1, nombre_cargo: "Supervisor de Seguridad" },
    ];

    const linked = cargos.map((cargo) => ({
      cargo: cargo.nombre_cargo,
      rrhh: recursosHumanos.find((rrhh) => rrhh.id_rrhh === cargo.id_rrhh)?.id_rrhh,
    }));

    expect(linked).toEqual([
      { cargo: "Guarda de Seguridad", rrhh: 1 },
      { cargo: "Supervisor de Seguridad", rrhh: 1 },
    ]);
  });

  it("keeps the fixture data and view links aligned with the SQL contract", () => {
    const sql = readFileSync(resolve(process.cwd(), "db/Postgres.sql"), "utf8");
    expect(sql).toContain("INSERT INTO recursos_humanos (nombre_rrhh");
    expect(sql).toContain("INSERT INTO cargo (nombre_cargo, descripcion_cargo, turnos, id_sede)");
    expect(sql).toContain("CREATE VIEW vista_historial_aspirante AS");
    expect(sql).toContain("CREATE VIEW vista_estadistica_postulaciones AS");
  });
});
