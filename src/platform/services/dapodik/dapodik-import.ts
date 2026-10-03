import { randomUUID } from "crypto";
import * as XLSX from "xlsx";
import { adminPrisma } from "@/platform/db/prisma";

export type DapodikPreviewItem = {
  row: number;
  status: "NEW" | "CHANGED" | "UNCHANGED" | "ERROR";
  identifier: string;
  name: string;
  changes?: string[];
  message?: string;
};

export type DapodikPreviewResult = {
  mode: "student" | "employee";
  total: number;
  newCount: number;
  changedCount: number;
  unchangedCount: number;
  errorCount: number;
  items: DapodikPreviewItem[];
};

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

export async function previewDapodikImport(
  tenantId: string,
  buffer: Buffer,
  mode: "student" | "employee",
): Promise<DapodikPreviewResult> {
  const rows = readSheet(buffer);
  const items: DapodikPreviewItem[] = [];

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const rowNumber = index + 6;

    if (mode === "student") {
      const nisn = text(row["NISN"]);
      const nis = text(row["NIPD"]);
      const fullName = text(row["Nama"]);
      const className = text(row["Rombel Saat Ini"]);

      if (!nisn || !nis || !fullName || !className) {
        items.push({
          row: rowNumber,
          status: "ERROR",
          identifier: nisn,
          name: fullName,
          message: "NISN, NIPD, Nama, atau Rombel Saat Ini kosong.",
        });
        continue;
      }

      const existing = await adminPrisma.student.findFirst({
        where: { tenantId, nisn },
        select: {
          nis: true,
          fullName: true,
          className: true,
        },
      });

      if (!existing) {
        items.push({
          row: rowNumber,
          status: "NEW",
          identifier: nisn,
          name: fullName,
          message: "Data siswa baru.",
        });
        continue;
      }

      const changes: string[] = [];

      if (existing.nis !== nis) changes.push("NIPD");
      if (existing.fullName !== fullName) changes.push("Nama");
      if (existing.className !== className) changes.push("Rombel");

      items.push({
        row: rowNumber,
        status: changes.length ? "CHANGED" : "UNCHANGED",
        identifier: nisn,
        name: fullName,
        changes: changes.length ? changes : undefined,
        message: changes.length
          ? `Data berubah: ${changes.join(", ")}.`
          : "Tidak ada perubahan.",
      });

      continue;
    }

    const nip = firstValue(row, [
      "NIP",
      "NIP Baru",
      "NIP Baru (Jika Ada)",
    ]);
    const nrk = firstValue(row, [
      "NRK",
      "Nomor Registrasi Kepegawaian",
    ]);
    const nik = firstValue(row, [
      "NIK",
      "No. KTP",
      "Nomor KTP",
      "Nomor Induk Kependudukan",
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

    const identifier = nip || nik;

    if (!identifier || !fullName) {
      items.push({
        row: rowNumber,
        status: "ERROR",
        identifier: identifier || "-",
        name: fullName,
        message: "NIP/NIK atau Nama kosong.",
      });
      continue;
    }

    const existing = nip
      ? await adminPrisma.employee.findUnique({
          where: {
            tenantId_nip: {
              tenantId,
              nip,
            },
          },
          select: {
            nip: true,
            nrk: true,
            nik: true,
            fullName: true,
            jabatan: true,
            unitKerja: true,
            instansi: true,
            statusKepegawaian: true,
          },
        })
      : nik
        ? await adminPrisma.employee.findUnique({
            where: {
              tenantId_nik: {
                tenantId,
                nik,
              },
            },
            select: {
              nip: true,
              nrk: true,
              nik: true,
              fullName: true,
              jabatan: true,
              unitKerja: true,
              instansi: true,
              statusKepegawaian: true,
            },
          })
        : null;

    if (!existing) {
      items.push({
        row: rowNumber,
        status: "NEW",
        identifier,
        name: fullName,
        message: "Data guru/pegawai baru.",
      });
      continue;
    }

    const changes: string[] = [];

    if ((existing.nrk ?? "") !== nrk && nrk) changes.push("NRK");
    if ((existing.nik ?? "") !== nik && nik) changes.push("NIK");
    if (existing.fullName !== fullName) changes.push("Nama");
    if (existing.jabatan !== jabatan) changes.push("Jabatan");
    if (existing.unitKerja !== unitKerja) changes.push("Unit Kerja");
    if (existing.instansi !== instansi) changes.push("Instansi");
    if (existing.statusKepegawaian !== statusKepegawaian) {
      changes.push("Status Kepegawaian");
    }

    items.push({
      row: rowNumber,
      status: changes.length ? "CHANGED" : "UNCHANGED",
      identifier: nip,
      name: fullName,
      changes: changes.length ? changes : undefined,
      message: changes.length
        ? `Data berubah: ${changes.join(", ")}.`
        : "Tidak ada perubahan.",
    });
  }

  return {
    mode,
    total: items.length,
    newCount: items.filter((item) => item.status === "NEW").length,
    changedCount: items.filter((item) => item.status === "CHANGED").length,
    unchangedCount: items.filter((item) => item.status === "UNCHANGED").length,
    errorCount: items.filter((item) => item.status === "ERROR").length,
    items,
  };
}

export async function importDapodikStudents(
  tenantId: string,
  buffer: Buffer,
  dryRun = false,
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
    const nik = text(row["NIK"]);
    const noKk = text(row["No KK"]);
    const jk = text(row["JK"]).toUpperCase();
    const jenisKelamin =
      jk === "P" ? "Perempuan" :
      jk === "L" ? "Laki-laki" :
      jk || "";
    const tingkatKelas =
      text(row["Rombel Saat Ini"]).match(/(\d+)/)?.[1] ?? "";
    const agama = text(row["Agama"]);
    const tanggalMasuk = normalizeDate(
      row["Tanggal Masuk Sekolah"] ?? row["Tanggal Masuk"],
    );

    if (!nisn || !nis || !fullName || !className) {
      result.errors.push({
        row: rowNumber,
        message: "NISN, NIPD, Nama, atau Rombel Saat Ini kosong.",
      });
      continue;
    }

    const existing = await adminPrisma.student.findUnique({
      where: {
        tenantId_nisn: {
          tenantId,
          nisn,
        },
      },
    });

    if (dryRun) {
      if (existing) result.updated++;
      else result.created++;
      continue;
    }

    if (!existing) {
      await adminPrisma.student.create({
        data: {
          id: crypto.randomUUID(),
          tenantId,
          nisn,
          nis,
          nik: nik || null,
          noKk: noKk || null,
          jenisKelamin: jenisKelamin || null,
          tingkatKelas: tingkatKelas || null,
          agama: agama || null,
          tanggalMasuk,
          fullName,
          className,
        },
      });

      result.created++;
      continue;
    }

    const data: {
      nis?: string;
      nik?: string;
      noKk?: string;
      jenisKelamin?: string;
      tingkatKelas?: string;
      agama?: string;
      tanggalMasuk?: Date;
      fullName?: string;
      className?: string;
    } = {};

    if (!existing.nis && nis) data.nis = nis;
    if (!existing.nik && nik) data.nik = nik;
    if (!existing.noKk && noKk) data.noKk = noKk;
    if (!existing.jenisKelamin && jenisKelamin) {
      data.jenisKelamin = jenisKelamin;
    }
    if (!existing.tingkatKelas && tingkatKelas) {
      data.tingkatKelas = tingkatKelas;
    }
    if (!existing.agama && agama) data.agama = agama;
    if (!existing.tanggalMasuk && tanggalMasuk) {
      data.tanggalMasuk = tanggalMasuk;
    }
    if (!existing.fullName && fullName) data.fullName = fullName;
    if (!existing.className && className) data.className = className;

    if (Object.keys(data).length === 0) {
      result.skipped++;
      continue;
    }

    await adminPrisma.student.update({
      where: { id: existing.id },
      data,
    });

    result.updated++;
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

    const nik = firstValue(row, [
      "NIK",
      "No. KTP",
      "Nomor KTP",
      "Nomor Induk Kependudukan",
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

    const identifier = nip || nik;

    if (!identifier || !fullName) {
      result.errors.push({
        row: rowNumber,
        message: "NIP/NIK atau Nama kosong",
      });
      continue;
    }

    // NIP/NIK dan Nama cukup untuk membuat master pegawai.
    // Field administratif yang belum tersedia dari file Dapodik diberi nilai default.

    const existing = nip
      ? await adminPrisma.employee.findUnique({
          where: {
            tenantId_nip: {
              tenantId,
              nip,
            },
          },
          select: { id: true },
        })
      : nik
        ? await adminPrisma.employee.findUnique({
            where: {
              tenantId_nik: {
                tenantId,
                nik,
              },
            },
            select: { id: true },
          })
        : null;

    if (dryRun) {
      if (existing) result.updated++;
      else result.created++;

      continue;
    }

    const data = {
      nip: nip || null,
      nrk: nrk || null,
      nik: nik || null,
      fullName,
      gelarDepan: null,
      gelarBelakang: null,
      jabatan: jabatan || "Belum diisi",
      unitKerja: unitKerja || "SMP Negeri 99 Jakarta",
      instansi: instansi || "SMP Negeri 99 Jakarta",
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
