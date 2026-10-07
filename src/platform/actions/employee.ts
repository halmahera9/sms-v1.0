'use server';

import {
  executeInAuthenticatedContext,
  AuthenticationError,
  AuthorizationError,
  assertAuthorizedAction,
} from '@/platform/auth';
import { EmployeeStatus } from '@prisma/client';
import type { ActionErrorCode, ActionError, ActionResponse } from '@/platform/types';

export type { ActionErrorCode, ActionError, ActionResponse };

export interface EmployeeRecordDTO {
  id: string;
  tenantId: string;
  nip: string | null;
  nrk: string | null;
  nik: string | null;
  fullName: string;
  jabatan: string;
  unitKerja: string;
  instansi: string;
  statusKepegawaian: EmployeeStatus;

  // Dapodik profile
  nuptk: string | null;
  noKk: string | null;
  jenisKelamin: string | null;
  tempatLahir: string | null;
  tanggalLahir: string | null;
  agama: string | null;
  alamatJalan: string | null;
  hp: string | null;
  email: string | null;
  jenisPtk: string | null;
  tugasTambahan: string | null;
  skPengangkatan: string | null;
  tmtPengangkatan: string | null;
  lembagaPengangkatan: string | null;
  pangkatGolongan: string | null;
  sumberGaji: string | null;
  namaIbuKandung: string | null;
  statusPerkawinan: string | null;
  namaSuamiIstri: string | null;
  tmtPns: string | null;
  npwp: string | null;
  kewarganegaraan: string | null;
  bank: string | null;
  nomorRekeningBank: string | null;
  rekeningAtasNama: string | null;
  karpeg: string | null;
  karisKarsu: string | null;
  nuks: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface EmployeeFilterDTO {
  search?: string;
  unitKerja?: string;
  status?: EmployeeStatus | 'ALL';
  limit?: number;
}

function handleActionError<T>(err: unknown): ActionResponse<T> {
  if (err instanceof AuthenticationError) {
    return {
      success: false,
      error: { code: 'UNAUTHENTICATED', message: err.message },
    };
  }

  if (err instanceof AuthorizationError) {
    return {
      success: false,
      error: { code: 'FORBIDDEN', message: err.message },
    };
  }

  if (err instanceof Error && err.message.startsWith('Validation Error:')) {
    return {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: err.message },
    };
  }

  if (
    err instanceof Error &&
    (err.message.startsWith('SECURITY ERROR:') ||
      err.message.startsWith('SECURITY/SCHEMA ERROR:'))
  ) {
    return {
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Akses ditolak oleh kebijakan keamanan data.',
      },
    };
  }

  console.error('[Employee Action Internal Error]:', err);

  return {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Terjadi kesalahan internal pada sistem pengelolaan pegawai.',
    },
  };
}

export interface SaveEmployeeDTO {
  id?: string;
  nip?: string | null;
  nrk?: string | null;
  nik?: string | null;
  fullName: string;
  jabatan?: string | null;
  unitKerja?: string | null;
  instansi?: string | null;
  statusKepegawaian: EmployeeStatus;

  nuptk?: string | null;
  noKk?: string | null;
  jenisKelamin?: string | null;
  tempatLahir?: string | null;
  tanggalLahir?: string | null;
  agama?: string | null;
  alamatJalan?: string | null;
  hp?: string | null;
  email?: string | null;
  jenisPtk?: string | null;
  tugasTambahan?: string | null;
  skPengangkatan?: string | null;
  tmtPengangkatan?: string | null;
  lembagaPengangkatan?: string | null;
  pangkatGolongan?: string | null;
  sumberGaji?: string | null;
  namaIbuKandung?: string | null;
  statusPerkawinan?: string | null;
  namaSuamiIstri?: string | null;
  tmtPns?: string | null;
  npwp?: string | null;
  kewarganegaraan?: string | null;
  bank?: string | null;
  nomorRekeningBank?: string | null;
  rekeningAtasNama?: string | null;
  karpeg?: string | null;
  karisKarsu?: string | null;
  nuks?: string | null;
}

export async function saveEmployeeAction(
  dto: SaveEmployeeDTO,
): Promise<ActionResponse<EmployeeRecordDTO>> {
  try {
    if (!dto || typeof dto !== 'object') {
      throw new Error('Validation Error: Payload data pegawai tidak valid.');
    }

    if (dto.nik && !/^\d{16}$/.test(dto.nik.trim())) {
      throw new Error(
        'Validation Error: NIK tidak valid. NIK harus tepat 16 angka.'
      );
    }

    if (
      !dto.fullName ||

      typeof dto.fullName !== 'string' ||
      dto.fullName.trim().length === 0 ||
      dto.fullName.trim().length > 255
    ) {
      throw new Error(
        'Validation Error: Nama pegawai wajib diisi dan maksimal 255 karakter.',
      );
    }

    const validStatuses: EmployeeStatus[] = Object.values(EmployeeStatus);

    if (!validStatuses.includes(dto.statusKepegawaian)) {
      throw new Error(
        'Validation Error: Status kepegawaian tidak valid.',
      );
    }

    const saved = await executeInAuthenticatedContext(async (context, tx) => {
      assertAuthorizedAction(context, 'STUDENT_WRITE');

      if (dto.id) {
        const existing = await tx.employee.findFirst({
          where: {
            id: dto.id,
            tenantId: context.tenantId,
          },
        });

        if (!existing) {
          throw new Error('Validation Error: Data pegawai tidak ditemukan.');
        }

        return tx.employee.update({
          where: { id: existing.id },
          data: {
            nip: dto.nip?.trim() || null,
            nrk: dto.nrk?.trim() || null,
            nik: dto.nik?.trim() || null,
            fullName: dto.fullName.trim(),
            jabatan: dto.jabatan?.trim() ?? existing.jabatan,
            unitKerja: dto.unitKerja?.trim() ?? existing.unitKerja,
            instansi: dto.instansi?.trim() ?? existing.instansi,
            statusKepegawaian: dto.statusKepegawaian,
            nuptk: dto.nuptk?.trim() || null,
            noKk: dto.noKk?.trim() || null,
            jenisKelamin: dto.jenisKelamin?.trim() || null,
            tempatLahir: dto.tempatLahir?.trim() || null,
            tanggalLahir: dto.tanggalLahir ? new Date(dto.tanggalLahir) : null,
            agama: dto.agama?.trim() || null,
            alamatJalan: dto.alamatJalan?.trim() || null,
            hp: dto.hp?.trim() || null,
            email: dto.email?.trim() || null,
            jenisPtk: dto.jenisPtk?.trim() || null,
            tugasTambahan: dto.tugasTambahan?.trim() || null,
            skPengangkatan: dto.skPengangkatan?.trim() || null,
            tmtPengangkatan: dto.tmtPengangkatan ? new Date(dto.tmtPengangkatan) : null,
            lembagaPengangkatan: dto.lembagaPengangkatan?.trim() || null,
            pangkatGolongan: dto.pangkatGolongan?.trim() || null,
            sumberGaji: dto.sumberGaji?.trim() || null,
            namaIbuKandung: dto.namaIbuKandung?.trim() || null,
            statusPerkawinan: dto.statusPerkawinan?.trim() || null,
            namaSuamiIstri: dto.namaSuamiIstri?.trim() || null,
            tmtPns: dto.tmtPns ? new Date(dto.tmtPns) : null,
            npwp: dto.npwp?.trim() || null,
            kewarganegaraan: dto.kewarganegaraan?.trim() || null,
            bank: dto.bank?.trim() || null,
            nomorRekeningBank: dto.nomorRekeningBank?.trim() || null,
            rekeningAtasNama: dto.rekeningAtasNama?.trim() || null,
            karpeg: dto.karpeg?.trim() || null,
            karisKarsu: dto.karisKarsu?.trim() || null,
            nuks: dto.nuks?.trim() || null,
          },
        });
      }

      return tx.employee.create({
        data: {
          id: crypto.randomUUID(),
          tenantId: context.tenantId,
          nip: dto.nip?.trim() || null,
          nrk: dto.nrk?.trim() || null,
          nik: dto.nik?.trim() || null,
          fullName: dto.fullName.trim(),
          jabatan: dto.jabatan?.trim() || '',
          unitKerja: dto.unitKerja?.trim() || '',
          instansi: dto.instansi?.trim() || 'SMP Negeri 99 Jakarta',
          statusKepegawaian: dto.statusKepegawaian,
          nuptk: dto.nuptk?.trim() || null,
          noKk: dto.noKk?.trim() || null,
          jenisKelamin: dto.jenisKelamin?.trim() || null,
          tempatLahir: dto.tempatLahir?.trim() || null,
          tanggalLahir: dto.tanggalLahir ? new Date(dto.tanggalLahir) : null,
          agama: dto.agama?.trim() || null,
          alamatJalan: dto.alamatJalan?.trim() || null,
          hp: dto.hp?.trim() || null,
          email: dto.email?.trim() || null,
          jenisPtk: dto.jenisPtk?.trim() || null,
          tugasTambahan: dto.tugasTambahan?.trim() || null,
          skPengangkatan: dto.skPengangkatan?.trim() || null,
          tmtPengangkatan: dto.tmtPengangkatan ? new Date(dto.tmtPengangkatan) : null,
          lembagaPengangkatan: dto.lembagaPengangkatan?.trim() || null,
          pangkatGolongan: dto.pangkatGolongan?.trim() || null,
          sumberGaji: dto.sumberGaji?.trim() || null,
          namaIbuKandung: dto.namaIbuKandung?.trim() || null,
          statusPerkawinan: dto.statusPerkawinan?.trim() || null,
          namaSuamiIstri: dto.namaSuamiIstri?.trim() || null,
          tmtPns: dto.tmtPns ? new Date(dto.tmtPns) : null,
          npwp: dto.npwp?.trim() || null,
          kewarganegaraan: dto.kewarganegaraan?.trim() || null,
          bank: dto.bank?.trim() || null,
          nomorRekeningBank: dto.nomorRekeningBank?.trim() || null,
          rekeningAtasNama: dto.rekeningAtasNama?.trim() || null,
          karpeg: dto.karpeg?.trim() || null,
          karisKarsu: dto.karisKarsu?.trim() || null,
          nuks: dto.nuks?.trim() || null,
        },
      });
    });

    return {
      success: true,
      data: {
        id: saved.id,
        tenantId: saved.tenantId,
        nip: saved.nip,
        nrk: saved.nrk,
        nik: saved.nik,
        fullName: saved.fullName,
        jabatan: saved.jabatan,
        unitKerja: saved.unitKerja,
        instansi: saved.instansi,
        statusKepegawaian: saved.statusKepegawaian,

        // Dapodik profile
        nuptk: saved.nuptk,
        noKk: saved.noKk,
        jenisKelamin: saved.jenisKelamin,
        tempatLahir: saved.tempatLahir,
        tanggalLahir: saved.tanggalLahir?.toISOString() ?? null,
        agama: saved.agama,
        alamatJalan: saved.alamatJalan,
        hp: saved.hp,
        email: saved.email,
        jenisPtk: saved.jenisPtk,
        tugasTambahan: saved.tugasTambahan,
        skPengangkatan: saved.skPengangkatan,
        tmtPengangkatan: saved.tmtPengangkatan?.toISOString() ?? null,
        lembagaPengangkatan: saved.lembagaPengangkatan,
        pangkatGolongan: saved.pangkatGolongan,
        sumberGaji: saved.sumberGaji,
        namaIbuKandung: saved.namaIbuKandung,
        statusPerkawinan: saved.statusPerkawinan,
        namaSuamiIstri: saved.namaSuamiIstri,
        tmtPns: saved.tmtPns?.toISOString() ?? null,
        npwp: saved.npwp,
        kewarganegaraan: saved.kewarganegaraan,
        bank: saved.bank,
        nomorRekeningBank: saved.nomorRekeningBank,
        rekeningAtasNama: saved.rekeningAtasNama,
        karpeg: saved.karpeg,
        karisKarsu: saved.karisKarsu,
        nuks: saved.nuks,

        createdAt: saved.createdAt.toISOString(),
        updatedAt: saved.updatedAt.toISOString(),
      },
    };
  } catch (err) {
    return handleActionError<EmployeeRecordDTO>(err);
  }
}

export async function getEmployeesAction(
  filter?: EmployeeFilterDTO
): Promise<ActionResponse<EmployeeRecordDTO[]>> {
  try {
    let effectiveLimit = 100;

    if (filter?.limit !== undefined) {
      if (
        typeof filter.limit !== 'number' ||
        !Number.isInteger(filter.limit) ||
        filter.limit < 1 ||
        filter.limit > 200
      ) {
        throw new Error(
          'Validation Error: limit must be an integer between 1 and 200.'
        );
      }

      effectiveLimit = filter.limit;
    }

    const items = await executeInAuthenticatedContext(async (context, tx) => {
      assertAuthorizedAction(context, 'EMPLOYEE_READ');

      const whereClause: Record<string, unknown> = {};

      if (filter?.unitKerja) {
        whereClause.unitKerja = filter.unitKerja;
      }

      if (filter?.status && filter.status !== 'ALL') {
        whereClause.statusKepegawaian = filter.status;
      }

      if (filter?.search && filter.search.trim() !== '') {
        const term = filter.search.trim();

        whereClause.OR = [
          { fullName: { contains: term, mode: 'insensitive' } },
          { nip: { contains: term } },
          { nrk: { contains: term } },
          { nik: { contains: term } },
          { jabatan: { contains: term, mode: 'insensitive' } },
        ];
      }

      const employees = await tx.employee.findMany({
        where: whereClause,
        orderBy: { fullName: 'asc' },
        take: effectiveLimit,
      });

      return employees.map((employee) => ({
        id: employee.id,
        tenantId: employee.tenantId,
        nip: employee.nip,
        nrk: employee.nrk,
        nik: employee.nik,
        fullName: employee.fullName,
        jabatan: employee.jabatan,
        unitKerja: employee.unitKerja,
        instansi: employee.instansi,
        statusKepegawaian: employee.statusKepegawaian,

        // Dapodik profile
        nuptk: employee.nuptk,
        noKk: employee.noKk,
        jenisKelamin: employee.jenisKelamin,
        tempatLahir: employee.tempatLahir,
        tanggalLahir: employee.tanggalLahir?.toISOString() ?? null,
        agama: employee.agama,
        alamatJalan: employee.alamatJalan,
        hp: employee.hp,
        email: employee.email,
        jenisPtk: employee.jenisPtk,
        tugasTambahan: employee.tugasTambahan,
        skPengangkatan: employee.skPengangkatan,
        tmtPengangkatan: employee.tmtPengangkatan?.toISOString() ?? null,
        lembagaPengangkatan: employee.lembagaPengangkatan,
        pangkatGolongan: employee.pangkatGolongan,
        sumberGaji: employee.sumberGaji,
        namaIbuKandung: employee.namaIbuKandung,
        statusPerkawinan: employee.statusPerkawinan,
        namaSuamiIstri: employee.namaSuamiIstri,
        tmtPns: employee.tmtPns?.toISOString() ?? null,
        npwp: employee.npwp,
        kewarganegaraan: employee.kewarganegaraan,
        bank: employee.bank,
        nomorRekeningBank: employee.nomorRekeningBank,
        rekeningAtasNama: employee.rekeningAtasNama,
        karpeg: employee.karpeg,
        karisKarsu: employee.karisKarsu,
        nuks: employee.nuks,

        createdAt: employee.createdAt.toISOString(),
        updatedAt: employee.updatedAt.toISOString(),
      }));
    });

    return {
      success: true,
      data: items,
    };
  } catch (err) {
    return handleActionError<EmployeeRecordDTO[]>(err);
  }
}
