'use server';

import {
  executeInAuthenticatedContext,
  AuthenticationError,
  AuthorizationError,
  assertAuthorizedAction,
} from '@/platform/auth';
import type { ActionResponse } from '@/platform/types';
import type {
  LetterTemplateRecordDTO,
  LetterTemplateFilterDTO,
} from '@/platform/types/letter-template';
import { randomUUID } from 'crypto';

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

  console.error('[LetterTemplate Action Internal Error]:', err);

  return {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Terjadi kesalahan internal pada sistem pengelolaan Template Surat.',
    },
  };
}

/**
 * Mengambil daftar Template Surat sesuai filter dan konteks tenant aktif.
 */
export async function getLetterTemplatesAction(
  filter?: LetterTemplateFilterDTO
): Promise<ActionResponse<LetterTemplateRecordDTO[]>> {
  try {
    const items = await executeInAuthenticatedContext(async (context, tx) => {
      assertAuthorizedAction(context, 'LETTER_TEMPLATE_READ');

      const whereClause: Record<string, unknown> = {};

      if (filter?.isActive !== undefined) {
        whereClause.isActive = filter.isActive;
      }

      if (filter?.jenisSurat && filter.jenisSurat.trim() !== '') {
        whereClause.letterType = filter.jenisSurat.trim();
      }

      if (filter?.search && filter.search.trim() !== '') {
        const term = filter.search.trim();
        whereClause.OR = [
          { name: { contains: term, mode: 'insensitive' } },
          { code: { contains: term, mode: 'insensitive' } },
          { letterType: { contains: term, mode: 'insensitive' } },
        ];
      }

      const templates = await tx.letterTemplate.findMany({
        where: whereClause,
        orderBy: { code: 'asc' },
      });

      return templates.map((tmpl) => ({
        id: tmpl.id,
        tenantId: tmpl.tenantId,
        kodeTemplate: tmpl.code,
        namaTemplate: tmpl.name,
        jenisSurat: tmpl.letterType,
        isiTemplate: tmpl.content,
        variabel: Array.isArray(tmpl.variables)
          ? (tmpl.variables as string[])
          : [],
        isActive: tmpl.isActive,
        statusLabel: tmpl.isActive ? ('Aktif' as const) : ('Tidak Aktif' as const),
        createdAt: tmpl.createdAt.toISOString(),
        updatedAt: tmpl.updatedAt.toISOString(),
      }));
    });

    return {
      success: true,
      data: items,
    };
  } catch (err) {
    return handleActionError<LetterTemplateRecordDTO[]>(err);
  }
}

/**
 * Menyediakan inisialisasi awal baku untuk Template Surat sekolah jika belum tersedia.
 */
export async function seedDefaultLetterTemplatesAction(): Promise<ActionResponse<number>> {
  try {
    const count = await executeInAuthenticatedContext(async (context, tx) => {
      assertAuthorizedAction(context, 'LETTER_TEMPLATE_WRITE');

      const tenantId = context.tenantId;
      const existingCount = await tx.letterTemplate.count({
        where: { tenantId },
      });

      if (existingCount > 0) {
        return existingCount;
      }

      const defaultTemplates = [
        {
          code: 'ST-01',
          name: 'Surat Tugas Pendidik & Tenaga Kependidikan',
          letterType: 'Surat Tugas',
          content: 'Berdasarkan penugasan kedinasan sekolah, dengan ini menugaskan kepada:\nNama: {{guru.nama_lengkap}}\nNIP: {{guru.nip}}\nNIK: {{guru.nik}}\nJabatan: {{guru.jabatan}}\nUnit Kerja: {{guru.unit_kerja}}\n\nUntuk melaksanakan tugas dinas sesuai ketentuan yang berlaku di {{sekolah.nama}}.',
          variables: ['guru.nama_lengkap', 'guru.nip', 'guru.nik', 'guru.jabatan', 'guru.unit_kerja', 'sekolah.nama'],
          isActive: true,
        },
        {
          code: 'SK-01',
          name: 'Surat Keterangan Aktif Belajar Siswa',
          letterType: 'Surat Keterangan',
          content: 'Yang bertanda tangan di bawah ini Kepala Sekolah {{sekolah.nama}}, menerangkan bahwa:\nNama: {{siswa.nama_lengkap}}\nNISN: {{siswa.nisn}}\nNIS: {{siswa.nis}}\nKelas: {{siswa.kelas}}\n\nAdalah benar siswa yang terdaftar aktif belajar pada tahun ajaran berjalan.',
          variables: ['sekolah.nama', 'siswa.nama_lengkap', 'siswa.nisn', 'siswa.nis', 'siswa.kelas', 'siswa.status'],
          isActive: true,
        },
        {
          code: 'SP-01',
          name: 'Surat Pernyataan Kesanggupan Tata Tertib Siswa',
          letterType: 'Surat Pernyataan',
          content: 'Saya yang bertanda tangan di bawah ini:\nNama Siswa: {{siswa.nama_lengkap}}\nNISN: {{siswa.nisn}}\nKelas: {{siswa.kelas}}\n\nMenyatakan dengan sesungguhnya bersedia mematuhi seluruh tata tertib dan peraturan yang berlaku di {{sekolah.nama}}.',
          variables: ['siswa.nama_lengkap', 'siswa.nisn', 'siswa.kelas', 'sekolah.nama'],
          isActive: true,
        },
        {
          code: 'SD-01',
          name: 'Surat Pengantar Berkas Dinas Sekolah',
          letterType: 'Surat Pengantar',
          content: 'Bersama ini kami kirimkan berkas administrasi kelengkapan dokumen:\nNomor Berkas: {{dokumen.nomor_surat}}\nTanggal Dokumen: {{dokumen.tanggal_surat}}\nPerihal: {{dokumen.perihal}}\nAtas Nama: {{siswa.nama_lengkap}} / {{guru.nama_lengkap}}\n\nDemikian surat pengantar ini dibuat untuk dapat dipergunakan sebagaimana mestinya.',
          variables: ['dokumen.nomor_surat', 'dokumen.tanggal_surat', 'dokumen.perihal', 'siswa.nama_lengkap', 'guru.nama_lengkap', 'sekolah.nama'],
          isActive: true,
        },
      ];

      for (const t of defaultTemplates) {
        await tx.letterTemplate.create({
          data: {
            id: randomUUID(),
            tenantId,
            code: t.code,
            name: t.name,
            letterType: t.letterType,
            content: t.content,
            variables: t.variables,
            isActive: t.isActive,
          },
        });
      }

      return defaultTemplates.length;
    });

    return {
      success: true,
      data: count,
    };
  } catch (err) {
    return handleActionError<number>(err);
  }
}
