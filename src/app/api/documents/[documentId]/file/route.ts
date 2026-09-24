import { NextResponse } from 'next/server';
import { executeInAuthenticatedContext } from '@/platform/auth/session';
import { assertAuthorizedAction } from '@/platform/auth/guards';
import { getObjectStorageProvider } from '@/platform/storage';

type RouteContext = {
  params: Promise<{ documentId: string }>;
};

export async function GET(
  _request: Request,
  { params }: RouteContext
) {
  try {
    const { documentId } = await params;

    const result = await executeInAuthenticatedContext(async (context, tx) => {
      assertAuthorizedAction(context, 'STUDENT_WORKFLOW_READ');

      const document = await tx.document.findFirst({
        where: {
          id: documentId,
          tenantId: context.tenantId,
        },
        include: {
          versions: {
            orderBy: {
              versionNumber: 'desc',
            },
            take: 1,
          },
        },
      });

      if (!document) {
        return {
          status: 404,
          error: 'Dokumen tidak ditemukan.',
        };
      }

      const version = document.versions[0];

      if (!version?.filePath) {
        return {
          status: 404,
          error: 'File dokumen tidak tersedia.',
        };
      }

      const storage = getObjectStorageProvider();
      const content = await storage.download(
        context.tenantId,
        version.filePath
      );

      return {
        status: 200,
        content,
        mimeType: version.mimeType || 'application/octet-stream',
        fileName: document.title,
      };
    });

    if (result.status !== 200 || !result.content) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status }
      );
    }

    return new NextResponse(new Uint8Array(result.content), {
      status: 200,
      headers: {
        'Content-Type': result.mimeType,
        'Content-Length': String(result.content.byteLength),
        'Content-Disposition': `inline; filename="${encodeURIComponent(result.fileName)}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('[Document File]', error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Gagal mengambil file dokumen.',
      },
      { status: 500 }
    );
  }
}
