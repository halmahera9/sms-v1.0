import { randomUUID } from "crypto";
import * as XLSX from "xlsx";
import { adminPrisma } from "@/platform/db/prisma";

export type DapodikPreviewField = {
  field: string;
  label: string;
  currentValue: string;
  incomingValue: string;
};

export type DapodikPreviewItem = {
  row: number;
  status: "NEW" | "FILL_BLANK" | "CONFLICT" | "UNCHANGED" | "ERROR";
  identifier: string;
  name: string;
  changes?: string[];
  fields?: DapodikPreviewField[];
  message?: string;
};

export type DapodikPreviewResult = {
  mode: "student" | "employee";
  total: number;
  newCount: number;
  fillBlankCount: number;
  conflictCount: number;
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
      const nik = text(row["NIK"]);
      const noKk = text(row["No KK"]);
      const jk = text(row["JK"]).toUpperCase();
      const jenisKelamin =
        jk === "P" ? "Perempuan" : jk === "L" ? "Laki-laki" : jk;
      const tingkatKelas =
        className.match(/(\d+)/)?.[1] ?? "";
      const agama = text(row["Agama"]);
      const tanggalMasuk = normalizeDate(
        row["Tanggal Masuk Sekolah"] ?? row["Tanggal Masuk"],
      );

      if (!nisn && !nis && !fullName && !className) {
        continue;
      }

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
          nik: true,
          noKk: true,
          jenisKelamin: true,
          tingkatKelas: true,
          agama: true,
          tanggalMasuk: true,
          className: true,
        },
      });

      const fields = [
        ["nis", "NIPD", existing?.nis, nis],
        ["fullName", "Nama", existing?.fullName, fullName],
        ["nik", "NIK", existing?.nik, nik],
        ["noKk", "No KK", existing?.noKk, noKk],
        ["jenisKelamin", "Jenis Kelamin", existing?.jenisKelamin, jenisKelamin],
        ["tingkatKelas", "Tingkat Kelas", existing?.tingkatKelas, tingkatKelas],
        ["agama", "Agama", existing?.agama, agama],
        [
          "tanggalMasuk",
          "Tanggal Masuk",
          existing?.tanggalMasuk?.toISOString().slice(0, 10) ?? "",
          tanggalMasuk?.toISOString().slice(0, 10) ?? "",
        ],
        ["className", "Rombel", existing?.className, className],
      ].map(([field, label, currentValue, incomingValue]) => ({
        field: String(field),
        label: String(label),
        currentValue: String(currentValue ?? ""),
        incomingValue: String(incomingValue ?? ""),
      }));

      if (!existing) {
        items.push({
          row: rowNumber,
          status: "NEW",
          identifier: nisn,
          name: fullName,
          fields,
          message: "Data siswa baru.",
        });
        continue;
      }

      const fillBlank = fields.filter(
        (x) => !x.currentValue && x.incomingValue,
      );
      const conflict = fields.filter(
        (x) =>
          x.currentValue &&
          x.incomingValue &&
          x.currentValue !== x.incomingValue,
      );
      const changed = [...fillBlank, ...conflict];
      const status = conflict.length
        ? "CONFLICT"
        : fillBlank.length
          ? "FILL_BLANK"
          : "UNCHANGED";

      items.push({
        row: rowNumber,
        status,
        identifier: nisn,
        name: fullName,
        fields: changed,
        changes: changed.map((x) => x.label),
        message:
          status === "CONFLICT"
            ? `Ada konflik pada: ${conflict.map((x) => x.label).join(", ")}.`
            : status === "FILL_BLANK"
              ? `Field kosong akan diisi: ${fillBlank.map((x) => x.label).join(", ")}.`
              : "Tidak ada perubahan.",
      });

      continue;
    }

    const nip = firstValue(row, ["NIP", "NIP Baru", "NIP Baru (Jika Ada)"]);
    const nrk = firstValue(row, ["NRK", "Nomor Registrasi Kepegawaian"]);
    const nik = firstValue(row, [
      "NIK",
      "No. KTP",
      "Nomor KTP",
      "Nomor Induk Kependudukan",
    ]);
    const fullName = firstValue(row, ["Nama", "Nama PTK", "Nama Lengkap"]);
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

    const dapodikFields = {
      nuptk: firstValue(row, ["NUPTK"]),
      noKk: firstValue(row, ["No. KK", "Nomor KK"]),
      jenisKelamin: firstValue(row, ["Jenis Kelamin"]),
      tempatLahir: firstValue(row, ["Tempat Lahir"]),
      tanggalLahir: normalizeDate(firstValue(row, ["Tanggal Lahir"])),
      agama: firstValue(row, ["Agama"]),
      alamatJalan: firstValue(row, ["Alamat Jalan", "Alamat"]),
      hp: firstValue(row, ["HP", "No. HP", "Nomor HP"]),
      email: firstValue(row, ["Email", "Surel"]),
      jenisPtk: firstValue(row, ["Jenis PTK"]),
      tugasTambahan: firstValue(row, ["Tugas Tambahan"]),
      skPengangkatan: firstValue(row, ["SK Pengangkatan"]),
      tmtPengangkatan: normalizeDate(firstValue(row, ["TMT Pengangkatan"])),
      lembagaPengangkatan: firstValue(row, ["Lembaga Pengangkatan"]),
      pangkatGolongan: firstValue(row, ["Pangkat Golongan"]),
      sumberGaji: firstValue(row, ["Sumber Gaji"]),
      namaIbuKandung: firstValue(row, ["Nama Ibu Kandung"]),
      statusPerkawinan: firstValue(row, ["Status Perkawinan"]),
      namaSuamiIstri: firstValue(row, ["Nama Suami/Istri"]),
      tmtPns: normalizeDate(firstValue(row, ["TMT PNS"])),
      npwp: firstValue(row, ["NPWP"]),
      kewarganegaraan: firstValue(row, ["Kewarganegaraan"]),
      bank: firstValue(row, ["Bank"]),
      nomorRekeningBank: firstValue(row, ["Nomor Rekening Bank", "No. Rekening Bank"]),
      rekeningAtasNama: firstValue(row, ["Rekening Atas Nama"]),
      karpeg: firstValue(row, ["Karpeg"]),
      karisKarsu: firstValue(row, ["Karis/Karsu"]),
      nuks: firstValue(row, ["NUKS"]),
    };

    const existing = nip
      ? await adminPrisma.employee.findFirst({
          where: { tenantId, nip },
          select: {
            nip: true,
            nrk: true,
            nik: true,
            fullName: true,
            jabatan: true,
            unitKerja: true,
            instansi: true,
            statusKepegawaian: true,
            nuptk: true,
            noKk: true,
            jenisKelamin: true,
            tempatLahir: true,
            tanggalLahir: true,
            agama: true,
            alamatJalan: true,
            hp: true,
            email: true,
            jenisPtk: true,
            tugasTambahan: true,
            skPengangkatan: true,
            tmtPengangkatan: true,
            lembagaPengangkatan: true,
            pangkatGolongan: true,
            sumberGaji: true,
            namaIbuKandung: true,
            statusPerkawinan: true,
            namaSuamiIstri: true,
            tmtPns: true,
            npwp: true,
            kewarganegaraan: true,
            bank: true,
            nomorRekeningBank: true,
            rekeningAtasNama: true,
            karpeg: true,
            karisKarsu: true,
            nuks: true,
            ...Object.fromEntries(
              Object.keys(dapodikFields).map((field) => [field, true]),
            ),
          },
        })
      : nik
        ? await adminPrisma.employee.findFirst({
            where: { tenantId, nik },
            select: {
              nip: true,
              nrk: true,
              nik: true,
              fullName: true,
              jabatan: true,
              unitKerja: true,
              instansi: true,
              statusKepegawaian: true,
            nuptk: true,
            noKk: true,
            jenisKelamin: true,
            tempatLahir: true,
            tanggalLahir: true,
            agama: true,
            alamatJalan: true,
            hp: true,
            email: true,
            jenisPtk: true,
            tugasTambahan: true,
            skPengangkatan: true,
            tmtPengangkatan: true,
            lembagaPengangkatan: true,
            pangkatGolongan: true,
            sumberGaji: true,
            namaIbuKandung: true,
            statusPerkawinan: true,
            namaSuamiIstri: true,
            tmtPns: true,
            npwp: true,
            kewarganegaraan: true,
            bank: true,
            nomorRekeningBank: true,
            rekeningAtasNama: true,
            karpeg: true,
            karisKarsu: true,
            nuks: true,
              ...Object.fromEntries(
                Object.keys(dapodikFields).map((field) => [field, true]),
              ),
            },
          })
        : null;

    const fields = [
      ["nip", "NIP", existing?.nip, nip],
      ["nrk", "NRK", existing?.nrk, nrk],
      ["nik", "NIK", existing?.nik, nik],
      ["fullName", "Nama", existing?.fullName, fullName],
      ["jabatan", "Jabatan", existing?.jabatan, jabatan],
      ["unitKerja", "Unit Kerja", existing?.unitKerja, unitKerja],
      ["instansi", "Instansi", existing?.instansi, instansi],
      ["statusKepegawaian", "Status Kepegawaian", existing?.statusKepegawaian, statusKepegawaian],
      ["nuptk", "NUPTK", existing?.nuptk, dapodikFields.nuptk],
      ["noKk", "No. KK", existing?.noKk, dapodikFields.noKk],
      ["jenisKelamin", "Jenis Kelamin", existing?.jenisKelamin, dapodikFields.jenisKelamin],
      ["tempatLahir", "Tempat Lahir", existing?.tempatLahir, dapodikFields.tempatLahir],
      ["tanggalLahir", "Tanggal Lahir", existing?.tanggalLahir, dapodikFields.tanggalLahir],
      ["agama", "Agama", existing?.agama, dapodikFields.agama],
      ["alamatJalan", "Alamat", existing?.alamatJalan, dapodikFields.alamatJalan],
      ["hp", "HP", existing?.hp, dapodikFields.hp],
      ["email", "Email", existing?.email, dapodikFields.email],
      ["jenisPtk", "Jenis PTK", existing?.jenisPtk, dapodikFields.jenisPtk],
      ["tugasTambahan", "Tugas Tambahan", existing?.tugasTambahan, dapodikFields.tugasTambahan],
      ["skPengangkatan", "SK Pengangkatan", existing?.skPengangkatan, dapodikFields.skPengangkatan],
      ["tmtPengangkatan", "TMT Pengangkatan", existing?.tmtPengangkatan, dapodikFields.tmtPengangkatan],
      ["lembagaPengangkatan", "Lembaga Pengangkatan", existing?.lembagaPengangkatan, dapodikFields.lembagaPengangkatan],
      ["pangkatGolongan", "Pangkat/Golongan", existing?.pangkatGolongan, dapodikFields.pangkatGolongan],
      ["sumberGaji", "Sumber Gaji", existing?.sumberGaji, dapodikFields.sumberGaji],
      ["namaIbuKandung", "Nama Ibu Kandung", existing?.namaIbuKandung, dapodikFields.namaIbuKandung],
      ["statusPerkawinan", "Status Perkawinan", existing?.statusPerkawinan, dapodikFields.statusPerkawinan],
      ["namaSuamiIstri", "Nama Suami/Istri", existing?.namaSuamiIstri, dapodikFields.namaSuamiIstri],
      ["tmtPns", "TMT PNS", existing?.tmtPns, dapodikFields.tmtPns],
      ["npwp", "NPWP", existing?.npwp, dapodikFields.npwp],
      ["kewarganegaraan", "Kewarganegaraan", existing?.kewarganegaraan, dapodikFields.kewarganegaraan],
      ["bank", "Bank", existing?.bank, dapodikFields.bank],
      ["nomorRekeningBank", "Nomor Rekening Bank", existing?.nomorRekeningBank, dapodikFields.nomorRekeningBank],
      ["rekeningAtasNama", "Rekening Atas Nama", existing?.rekeningAtasNama, dapodikFields.rekeningAtasNama],
      ["karpeg", "Karpeg", existing?.karpeg, dapodikFields.karpeg],
      ["karisKarsu", "Karis/Karsu", existing?.karisKarsu, dapodikFields.karisKarsu],
      ["nuks", "NUKS", existing?.nuks, dapodikFields.nuks],
    ].map(([field, label, currentValue, incomingValue]) => ({
      field: String(field),
      label: String(label),
      currentValue: currentValue instanceof Date
        ? currentValue.toISOString()
        : String(currentValue ?? ""),
      incomingValue: incomingValue instanceof Date
        ? incomingValue.toISOString()
        : String(incomingValue ?? ""),
    }));

    if (!existing) {
      items.push({
        row: rowNumber,
        status: "NEW",
        identifier,
        name: fullName,
        fields,
        message: "Data guru/pegawai baru.",
      });
      continue;
    }

    const fillBlank = fields.filter(
      (x) => !x.currentValue && x.incomingValue,
    );
    const conflict = fields.filter(
      (x) =>
        x.currentValue &&
        x.incomingValue &&
        x.currentValue !== x.incomingValue,
    );
    const changed = [...fillBlank, ...conflict];
    const status = conflict.length
      ? "CONFLICT"
      : fillBlank.length
        ? "FILL_BLANK"
        : "UNCHANGED";

    items.push({
      row: rowNumber,
      status,
      identifier,
      name: fullName,
      fields: changed,
      changes: changed.map((x) => x.label),
      message:
        status === "CONFLICT"
          ? `Ada konflik pada: ${conflict.map((x) => x.label).join(", ")}.`
          : status === "FILL_BLANK"
            ? `Field kosong akan diisi: ${fillBlank.map((x) => x.label).join(", ")}.`
            : "Tidak ada perubahan.",
    });
  }

  return {
    mode,
    total: items.length,
    newCount: items.filter((x) => x.status === "NEW").length,
    fillBlankCount: items.filter((x) => x.status === "FILL_BLANK").length,
    conflictCount: items.filter((x) => x.status === "CONFLICT").length,
    unchangedCount: items.filter((x) => x.status === "UNCHANGED").length,
    errorCount: items.filter((x) => x.status === "ERROR").length,
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


export async function applyDapodikStudentUpdates(
  tenantId: string,
  buffer: Buffer,
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
    const tingkatKelas = className.match(/(\d+)/)?.[1] ?? "";
    const agama = text(row["Agama"]);
    const tanggalMasuk = normalizeDate(
      row["Tanggal Masuk Sekolah"] ?? row["Tanggal Masuk"],
    );

    if (!nisn && !nis && !fullName && !className) {
      continue;
    }

    if (!nisn || !nis || !fullName || !className) {
      result.errors.push({
        row: rowNumber,
        message: "NISN, NIPD, Nama, atau Rombel Saat Ini kosong.",
      });
      continue;
    }

    const existing = await adminPrisma.student.findFirst({
      where: { tenantId, nisn },
    });

    // Data baru hanya dibuat ketika operator menekan APPLY.
    // Preview tetap mengklasifikasikan sebagai NEW.


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

    if (!existing!.nis && nis) data.nis = nis;
    if (!existing!.nik && nik) data.nik = nik;
    if (!existing!.noKk && noKk) data.noKk = noKk;
    if (!existing!.jenisKelamin && jenisKelamin) {
      data.jenisKelamin = jenisKelamin;
    }
    if (!existing!.tingkatKelas && tingkatKelas) {
      data.tingkatKelas = tingkatKelas;
    }
    if (!existing!.agama && agama) data.agama = agama;
    if (!existing!.tanggalMasuk && tanggalMasuk) {
      data.tanggalMasuk = tanggalMasuk;
    }
    if (!existing!.fullName && fullName) data.fullName = fullName;
    if (!existing!.className && className) data.className = className;

    if (Object.keys(data).length === 0) {
      result.skipped++;
      continue;
    }

    await adminPrisma.student.update({
      where: { id: existing!.id },
      data,
    });

    result.updated++;
  }

  return result;
}


export async function applyDapodikEmployeeUpdates(
  tenantId: string,
  buffer: Buffer,
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

    const nip = firstValue(row, ["NIP", "NIP Baru", "NIP Baru (Jika Ada)"]);
    const nrk = firstValue(row, ["NRK", "Nomor Registrasi Kepegawaian"]);
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

    if (!nip || !fullName) {
      if (!nip && !fullName) continue;

      result.errors.push({
        row: rowNumber,
        message: "NIP atau Nama pegawai kosong.",
      });
      continue;
    }

    const existing = await adminPrisma.employee.findFirst({
      where: {
        tenantId,
        nip,
      },
    });

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

    const jabatan = firstValue(row, [
      "Jabatan",
      "Jabatan PTK",
      "Jabatan/Tugas",
    ]);

    const statusRaw = firstValue(row, [
      "Status Kepegawaian",
      "Status Kepegawaian PTK",
      "Status Pegawai",
    ]);

    const statusKepegawaian = employeeStatus(statusRaw);

    const nuptk = firstValue(row, ["NUPTK"]);
    const noKk = firstValue(row, ["No. KK", "No KK", "Nomor KK"]);
    const jenisKelamin = firstValue(row, ["Jenis Kelamin", "JK"]);
    const tempatLahir = firstValue(row, ["Tempat Lahir"]);
    const tanggalLahir = normalizeDate(row["Tanggal Lahir"]);
    const agama = firstValue(row, ["Agama"]);
    const alamatJalan = firstValue(row, ["Alamat Jalan", "Alamat"]);
    const hp = firstValue(row, ["HP", "No. HP", "Nomor HP"]);
    const email = firstValue(row, ["Email", "Surel"]);
    const jenisPtk = firstValue(row, ["Jenis PTK", "Jenis GTK"]);
    const tugasTambahan = firstValue(row, ["Tugas Tambahan"]);
    const skPengangkatan = firstValue(row, ["SK Pengangkatan"]);
    const tmtPengangkatan = normalizeDate(row["TMT Pengangkatan"]);
    const lembagaPengangkatan = firstValue(row, ["Lembaga Pengangkatan"]);
    const pangkatGolongan = firstValue(row, ["Pangkat Golongan"]);
    const sumberGaji = firstValue(row, ["Sumber Gaji"]);
    const namaIbuKandung = firstValue(row, ["Nama Ibu Kandung"]);
    const statusPerkawinan = firstValue(row, ["Status Perkawinan"]);
    const namaSuamiIstri = firstValue(row, ["Nama Suami/Istri"]);
    const tmtPns = normalizeDate(row["TMT PNS"]);
    const npwp = firstValue(row, ["NPWP"]);
    const kewarganegaraan = firstValue(row, ["Kewarganegaraan"]);
    const bank = firstValue(row, ["Bank"]);
    const nomorRekeningBank = firstValue(row, [
      "Nomor Rekening Bank",
      "No. Rekening Bank",
    ]);
    const rekeningAtasNama = firstValue(row, ["Rekening Atas Nama"]);
    const karpeg = firstValue(row, ["Karpeg"]);
    const karisKarsu = firstValue(row, ["Karis/Karsu"]);
    const nuks = firstValue(row, ["NUKS"]);

    if (!existing) {
      await adminPrisma.employee.create({
        data: {
          id: crypto.randomUUID(),
          tenantId,
          nip: nip || null,
          nrk: nrk || null,
          nik: nik || null,
          fullName,
          jabatan: jabatan || "Belum diisi",
          unitKerja: unitKerja || "SMP Negeri 99 Jakarta",
          instansi: instansi || "SMP Negeri 99 Jakarta",
          statusKepegawaian: statusKepegawaian || "NON_ASN",
          nuptk: nuptk || null,
          noKk: noKk || null,
          jenisKelamin: jenisKelamin || null,
          tempatLahir: tempatLahir || null,
          tanggalLahir: tanggalLahir || null,
          agama: agama || null,
          alamatJalan: alamatJalan || null,
          hp: hp || null,
          email: email || null,
          jenisPtk: jenisPtk || null,
          tugasTambahan: tugasTambahan || null,
          skPengangkatan: skPengangkatan || null,
          tmtPengangkatan: tmtPengangkatan || null,
          lembagaPengangkatan: lembagaPengangkatan || null,
          pangkatGolongan: pangkatGolongan || null,
          sumberGaji: sumberGaji || null,
          namaIbuKandung: namaIbuKandung || null,
          statusPerkawinan: statusPerkawinan || null,
          namaSuamiIstri: namaSuamiIstri || null,
          tmtPns: tmtPns || null,
          npwp: npwp || null,
          kewarganegaraan: kewarganegaraan || null,
          bank: bank || null,
          nomorRekeningBank: nomorRekeningBank || null,
          rekeningAtasNama: rekeningAtasNama || null,
          karpeg: karpeg || null,
          karisKarsu: karisKarsu || null,
          nuks: nuks || null,
        },
      });

      result.created++;
      continue;
    }

    const currentEmployee = existing;

    const data: Record<string, unknown> = {};

    const put = (field: string, current: unknown, incoming: unknown) => {
      if (
        (current === null ||
          current === undefined ||
          current === "") &&
        incoming !== null &&
        incoming !== undefined &&
        incoming !== ""
      ) {
        data[field] = incoming;
      }
    };

    put("nrk", existing.nrk, nrk);
    put("nik", existing.nik, nik);
    put("fullName", existing.fullName, fullName);
    put("jabatan", existing.jabatan, jabatan);
    put("unitKerja", existing.unitKerja, unitKerja);
    put("instansi", existing.instansi, instansi);

    put("nuptk", existing.nuptk, nuptk);
    put("noKk", existing.noKk, noKk);
    put("jenisKelamin", existing.jenisKelamin, jenisKelamin);
    put("tempatLahir", existing.tempatLahir, tempatLahir);
    put("tanggalLahir", existing.tanggalLahir, tanggalLahir);
    put("agama", existing.agama, agama);
    put("alamatJalan", existing.alamatJalan, alamatJalan);
    put("hp", existing.hp, hp);
    put("email", existing.email, email);
    put("jenisPtk", existing.jenisPtk, jenisPtk);
    put("tugasTambahan", existing.tugasTambahan, tugasTambahan);
    put("skPengangkatan", existing.skPengangkatan, skPengangkatan);
    put("tmtPengangkatan", existing.tmtPengangkatan, tmtPengangkatan);
    put(
      "lembagaPengangkatan",
      existing.lembagaPengangkatan,
      lembagaPengangkatan,
    );
    put("pangkatGolongan", existing.pangkatGolongan, pangkatGolongan);
    put("sumberGaji", existing.sumberGaji, sumberGaji);
    put("namaIbuKandung", existing.namaIbuKandung, namaIbuKandung);
    put(
      "statusPerkawinan",
      existing.statusPerkawinan,
      statusPerkawinan,
    );
    put("namaSuamiIstri", existing.namaSuamiIstri, namaSuamiIstri);
    put("tmtPns", existing.tmtPns, tmtPns);
    put("npwp", existing.npwp, npwp);
    put("kewarganegaraan", existing.kewarganegaraan, kewarganegaraan);
    put("bank", existing.bank, bank);
    put(
      "nomorRekeningBank",
      existing.nomorRekeningBank,
      nomorRekeningBank,
    );
    put(
      "rekeningAtasNama",
      existing.rekeningAtasNama,
      rekeningAtasNama,
    );
    put("karpeg", existing.karpeg, karpeg);
    put("karisKarsu", existing.karisKarsu, karisKarsu);
    put("nuks", existing.nuks, nuks);

    if (
      (existing.statusKepegawaian === null ||
        existing.statusKepegawaian === undefined) &&
      statusKepegawaian
    ) {
      data.statusKepegawaian = statusKepegawaian;
    }

    if (Object.keys(data).length === 0) {
      result.skipped++;
      continue;
    }

    await adminPrisma.employee.update({
      where: {
        id: existing.id,
      },
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
      ? await adminPrisma.employee.findFirst({
          where: {
            tenantId,
            nip,
          },
          select: { id: true },
        })
      : nik
        ? await adminPrisma.employee.findFirst({
            where: {
              tenantId,
              nik,
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
