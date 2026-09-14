import { randomUUID } from "crypto";
import * as XLSX from "xlsx";
import { adminPrisma } from "@/platform/db/prisma";

type ImportResult = {
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
};

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeDate(value: unknown): Date | null {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  const raw = text(value);
  const date = new Date(raw);

  return Number.isNaN(date.getTime()) ? null : date;
}

function readSheet(buffer: Buffer): Record<string, unknown>[] {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,
  });

  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    range: 4,
    defval: "",
  });
}

export async function importDapodikStudents(
  tenantId: string,
  buffer: Buffer,
  dryRun = true,
): Promise<ImportResult> {
  const rows = readSheet(buffer);

  const result: ImportResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const rowNumber = index + 6;

    const nisn = text(row["NISN"]);
    const nis = text(row["NIPD"]);
    const fullName = text(row["Nama"]);
    const className = text(row["Rombel Saat Ini"]);

    if (!nisn || !nis || !fullName) {
      result.errors.push({
        row: rowNumber,
        message: "NISN, NIPD, atau Nama kosong",
      });
      continue;
    }

    if (!className) {
      result.errors.push({
        row: rowNumber,
        message: `Rombel Saat Ini kosong untuk ${fullName}`,
      });
      continue;
    }

    if (dryRun) {
      const existing = await adminPrisma.student.findFirst({
        where: {
          tenantId,
          nisn,
        },
        select: { id: true },
      });

      if (existing) result.updated++;
      else result.created++;

      continue;
    }

    const existing = await adminPrisma.student.findFirst({
      where: {
        tenantId,
        nisn,
      },
      select: { id: true },
    });

    const data = {
      tenantId,
      nisn,
      nis,
      fullName,
      className,
      jurusan: null,
    };

    if (existing) {
      await adminPrisma.student.update({
        where: { id: existing.id },
        data: {
          nisn: data.nisn,
          nis: data.nis,
          fullName: data.fullName,
          className: data.className,
          jurusan: data.jurusan,
        },
      });

      result.updated++;
    } else {
      await adminPrisma.student.create({
        data: {
          id: randomUUID(),
          ...data,
        },
      });

      result.created++;
    }
  }

  return result;
}

function employeeStatus(value: unknown): "PNS" | "PPPK" | "HONORER" | "NON_ASN" {
  const raw = text(value).toUpperCase();

  if (raw.includes("PPPK")) return "PPPK";
  if (raw.includes("PNS")) return "PNS";
  if (raw.includes("HONOR")) return "HONORER";

  return "NON_ASN";
}

function firstValue(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = text(row[key]);
    if (value) return value;
  }

  return "";
}

export async function importDapodikEmployees(
  tenantId: string,
  buffer: Buffer,
  dryRun = true,
): Promise<ImportResult> {
  const rows = readSheet(buffer);

  const result: ImportResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const rowNumber = index + 6;

    const nip = firstValue(row, [
      "NIP",
      "NIP Baru",
      "NIP Baru (Jika Ada)",
    ]);

    const nrk = firstValue(row, [
      "NRK",
      "Nomor Registrasi Kepegawaian",
    ]);

    const fullName = firstValue(row, [
      "Nama",
      "Nama PTK",
      "Nama Lengkap",
    ]);

    const jabatan = firstValue(row, [
      "Jabatan",
      "Jabatan PTK",
      "Jabatan/Tugas",
    ]);

    const unitKerja = firstValue(row, [
      "Unit Kerja",
      "Unit Kerja PTK",
      "Rombel",
    ]);

    const instansi = firstValue(row, [
      "Instansi",
      "Sekolah",
      "Nama Sekolah",
    ]);

    const statusKepegawaian = employeeStatus(
      firstValue(row, [
        "Status Kepegawaian",
        "Status Kepegawaian PTK",
        "Status Pegawai",
      ]),
    );

    if (!nip || !fullName) {
      result.errors.push({
        row: rowNumber,
        message: "NIP atau Nama kosong",
      });
      continue;
    }

    if (!jabatan || !unitKerja || !instansi) {
      result.errors.push({
        row: rowNumber,
        message: `Data wajib Employee tidak lengkap untuk ${fullName}`,
      });
      continue;
    }

    if (dryRun) {
      const existing = await adminPrisma.employee.findUnique({
        where: {
          tenantId_nip: {
            tenantId,
            nip,
          },
        },
        select: { id: true },
      });

      if (existing) result.updated++;
      else result.created++;

      continue;
    }

    const existing = await adminPrisma.employee.findUnique({
      where: {
        tenantId_nip: {
          tenantId,
          nip,
        },
      },
      select: { id: true },
    });

    const data = {
      nip,
      nrk: nrk || null,
      fullName,
      gelarDepan: null,
      gelarBelakang: null,
      jabatan,
      unitKerja,
      instansi,
      statusKepegawaian,
    };

    if (existing) {
      await adminPrisma.employee.update({
        where: { id: existing.id },
        data,
      });

      result.updated++;
    } else {
      await adminPrisma.employee.create({
        data: {
          id: randomUUID(),
          tenantId,
          ...data,
        },
      });

      result.created++;
    }
  }

  return result;
}
