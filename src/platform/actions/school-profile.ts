'use server';

import {
  executeInAuthenticatedContext,
  AuthenticationError,
  AuthorizationError,
  assertAuthorizedAction,
} from '@/platform/auth';
import type { ActionResponse } from '@/platform/types';
import type {
  SchoolProfileDTO,
  SchoolSigner,
  SchoolLetterheadConfig,
  UpdateSchoolProfileInput,
} from '@/platform/types/school-profile';
import { getObjectStorageProvider } from '@/platform/storage';

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

  console.error('[SchoolProfile Action Internal Error]:', err);

  return {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Terjadi kesalahan internal pada sistem konfigurasi identitas sekolah.',
    },
  };
}

/**
 * Mengambil data resmi Identitas Sekolah dan konfigurasi Kop Surat serta Penandatangan.
 */
export async function getSchoolProfileAction(): Promise<ActionResponse<SchoolProfileDTO>> {
  try {
    const profile = await executeInAuthenticatedContext(async (context, tx) => {
      assertAuthorizedAction(context, 'SCHOOL_PROFILE_READ');

      const tenant = await tx.tenant.findUnique({
        where: { id: context.tenantId },
      });

      if (!tenant) {
        throw new Error('Validation Error: Identitas sekolah (tenant) tidak ditemukan.');
      }

      const signers: SchoolSigner[] = Array.isArray(tenant.signers)
        ? (tenant.signers as unknown as SchoolSigner[])
        : [];

      const kopSurat: SchoolLetterheadConfig | null =
        tenant.letterheadConfig && typeof tenant.letterheadConfig === 'object'
          ? (tenant.letterheadConfig as unknown as SchoolLetterheadConfig)
          : null;

      return {
        tenantId: tenant.id,
        namaSekolah: tenant.name,
        kodeSekolah: tenant.code,
        npsn: tenant.npsn,
        alamat: tenant.address,
        telepon: tenant.phone,
        email: tenant.email,
        logoPath: tenant.logoPath,
        kopSurat,
        penandatangan: signers,
        status: tenant.status,
        updatedAt: tenant.updatedAt.toISOString(),
      };
    });

    return {
      success: true,
      data: profile,
    };
  } catch (err) {
    return handleActionError<SchoolProfileDTO>(err);
  }
}

/**
 * Memperbarui Identitas Sekolah dan Kop Surat.
 */
export async function updateSchoolProfileAction(
  input: UpdateSchoolProfileInput
): Promise<ActionResponse<SchoolProfileDTO>> {
  try {
    const updated = await executeInAuthenticatedContext(async (context, tx) => {
      assertAuthorizedAction(context, 'SCHOOL_PROFILE_WRITE');

      const dataToUpdate: Record<string, unknown> = {};

      if (input.namaSekolah !== undefined) {
        if (!input.namaSekolah.trim()) {
          throw new Error('Validation Error: Nama sekolah tidak boleh kosong.');
        }
        dataToUpdate.name = input.namaSekolah.trim();
      }

      if (input.npsn !== undefined) {
        dataToUpdate.npsn = input.npsn.trim() || null;
      }

      if (input.alamat !== undefined) {
        dataToUpdate.address = input.alamat.trim() || null;
      }

      if (input.telepon !== undefined) {
        dataToUpdate.phone = input.telepon.trim() || null;
      }

      if (input.email !== undefined) {
        dataToUpdate.email = input.email.trim() || null;
      }

      if (input.kopSurat !== undefined) {
        dataToUpdate.letterheadConfig = input.kopSurat;
      }

      const tenant = await tx.tenant.update({
        where: { id: context.tenantId },
        data: dataToUpdate,
      });

      const signers: SchoolSigner[] = Array.isArray(tenant.signers)
        ? (tenant.signers as unknown as SchoolSigner[])
        : [];

      const kopSurat: SchoolLetterheadConfig | null =
        tenant.letterheadConfig && typeof tenant.letterheadConfig === 'object'
          ? (tenant.letterheadConfig as unknown as SchoolLetterheadConfig)
          : null;

      return {
        tenantId: tenant.id,
        namaSekolah: tenant.name,
        kodeSekolah: tenant.code,
        npsn: tenant.npsn,
        alamat: tenant.address,
        telepon: tenant.phone,
        email: tenant.email,
        logoPath: tenant.logoPath,
        kopSurat,
        penandatangan: signers,
        status: tenant.status,
        updatedAt: tenant.updatedAt.toISOString(),
      };
    });

    return {
      success: true,
      data: updated,
    };
  } catch (err) {
    return handleActionError<SchoolProfileDTO>(err);
  }
}

/**
 * Memperbarui daftar pejabat Penandatangan surat dinas sekolah.
 */
export async function updateSchoolSignersAction(
  signers: SchoolSigner[]
): Promise<ActionResponse<SchoolSigner[]>> {
  try {
    const updatedSigners = await executeInAuthenticatedContext(async (context, tx) => {
      assertAuthorizedAction(context, 'SCHOOL_PROFILE_WRITE');

      for (const s of signers) {
        if (!s.nama || !s.nama.trim()) {
          throw new Error('Validation Error: Nama penandatangan tidak boleh kosong.');
        }
        if (!s.jabatan || !s.jabatan.trim()) {
          throw new Error('Validation Error: Jabatan penandatangan tidak boleh kosong.');
        }
      }

      const cleanSigners: SchoolSigner[] = signers.map((s) => ({
        nama: s.nama.trim(),
        nip: s.nip?.trim() || undefined,
        nik: s.nik?.trim() || undefined,
        jabatan: s.jabatan.trim(),
        isActive: Boolean(s.isActive),
      }));

      await tx.tenant.update({
        where: { id: context.tenantId },
        data: {
          signers: cleanSigners as any,
        },
      });

      return cleanSigners;
    });

    return {
      success: true,
      data: updatedSigners,
    };
  } catch (err) {
    return handleActionError<SchoolSigner[]>(err);
  }
}

/**
 * Mengunggah Logo Sekolah menggunakan abstraksi penyimpanan objek yang sudah ada.
 */
export async function uploadSchoolLogoAction(
  formData: FormData
): Promise<ActionResponse<{ logoPath: string }>> {
  try {
    const file = formData.get('logo') as File | null;
    if (!file) {
      throw new Error('Validation Error: Berkas logo tidak ditemukan dalam permintaan.');
    }

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Validation Error: Format berkas logo harus berupa PNG, JPEG, WEBP, atau SVG.');
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const result = await executeInAuthenticatedContext(async (context, tx) => {
      assertAuthorizedAction(context, 'SCHOOL_PROFILE_WRITE');

      const storage = getObjectStorageProvider();
      const extension = file.name.split('.').pop()?.toLowerCase() || 'png';
      const storagePath = `tenants/${context.tenantId}/branding/logo.${extension}`;

      await storage.upload({
        tenantId: context.tenantId,
        storagePath,
        content: buffer,
        mimeType: file.type,
      });

      await tx.tenant.update({
        where: { id: context.tenantId },
        data: {
          logoPath: storagePath,
        },
      });

      return { logoPath: storagePath };
    });

    return {
      success: true,
      data: result,
    };
  } catch (err) {
    return handleActionError<{ logoPath: string }>(err);
  }
}
