"use server";

import {
  executeInAuthenticatedContext,
  assertAuthorizedAction,
} from "@/platform/auth";
import {
  importDapodikEmployees,
  importDapodikStudents,
  previewDapodikImport,
} from "@/platform/services/dapodik/dapodik-import";

export type DapodikImportActionResult = {
  ok: boolean;
  mode: "employee" | "student";
  dryRun: boolean;
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
  errorMessage?: string;
};

export async function importDapodikAction(
  formData: FormData,
): Promise<DapodikImportActionResult> {
  const mode = formData.get("mode");
  const dryRun = formData.get("dryRun") !== "false";
  const file = formData.get("file");

  if (mode !== "employee" && mode !== "student") {
    return {
      ok: false,
      mode: "student",
      dryRun,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
      errorMessage: "Mode import tidak valid.",
    };
  }

  if (!(file instanceof File) || file.size === 0) {
    return {
      ok: false,
      mode,
      dryRun,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
      errorMessage: "File Excel wajib dipilih.",
    };
  }

  const allowed = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
  ];

  if (!allowed.includes(file.type) && !file.name.match(/\.(xlsx|xls)$/i)) {
    return {
      ok: false,
      mode,
      dryRun,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
      errorMessage: "File harus berupa Excel (.xlsx atau .xls).",
    };
  }

  try {
    return await executeInAuthenticatedContext(async (context) => {
      assertAuthorizedAction(context, "STUDENT_WRITE");

      const buffer = Buffer.from(await file.arrayBuffer());

      const result =
        mode === "student"
          ? await importDapodikStudents(
              context.tenantId,
              buffer,
              dryRun,
            )
          : await importDapodikEmployees(
              context.tenantId,
              buffer,
              dryRun,
            );

      return {
        ok: true,
        mode,
        dryRun,
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        errors: result.errors,
      };
    });
  } catch (error) {
    return {
      ok: false,
      mode,
      dryRun,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
      errorMessage:
        error instanceof Error ? error.message : "Import Dapodik gagal.",
    };
  }
}


export async function previewDapodikAction(
  formData: FormData,
) {
  const mode = formData.get("mode");
  const file = formData.get("file");

  if (mode !== "employee" && mode !== "student") {
    throw new Error("Mode import tidak valid.");
  }

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("File Excel wajib dipilih.");
  }

  return executeInAuthenticatedContext(async (context) => {
    assertAuthorizedAction(context, "STUDENT_WRITE");
    const buffer = Buffer.from(await file.arrayBuffer());
    return previewDapodikImport(context.tenantId, buffer, mode);
  });
}
