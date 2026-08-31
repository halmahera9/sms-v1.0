import { NextRequest } from 'next/server';
import { submitPublicDocumentUploadAction } from '@/domains/document/invitation/upload';

export async function POST(request: NextRequest) {
  try {
    // 1. Parse multipart/form-data
    const formData = await request.formData();

    // 2. Extract required fields
    const token = formData.get('token');
    const file = formData.get('file');

    // 3. Minimal HTTP validation
    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      return Response.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Token field is required.',
          },
        },
        { status: 400 }
      );
    }

    if (!file || !(file instanceof File)) {
      return Response.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'File field is required.',
          },
        },
        { status: 400 }
      );
    }

    // 4. File Ã¢â€ â€™ Buffer
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // 5. Extract file metadata
    const fileName = file.name || 'uploaded_file';
    const mimeType = file.type || undefined;

    // 6. Delegate to domain action
    const result = await submitPublicDocumentUploadAction({
      rawToken: token.trim(),
      fileName: fileName.trim(),
      fileBuffer,
      mimeType,
    });

    // 7. Simple ActionErrorCode Ã¢â€ â€™ HTTP mapping
    if (!result.success) {
      const error = result.error!;
      const code = error.code;

      let status = 500;
      if (code === 'VALIDATION_ERROR') status = 400;
      else if (code === 'DOMAIN_ERROR') status = 400; // Domain errors as 400
      // Note: No message parsing, all domain errors get 400

      return Response.json(result, { status });
    }

    // 8. Success
    return Response.json(result, { status: 200 });

  } catch (error: unknown) {
    return Response.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error.',
        },
      },
      { status: 500 }
    );
  }
}
