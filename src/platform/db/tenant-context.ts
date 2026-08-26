import { prisma } from './prisma';

/**
 * Transaction client type extracted directly from Prisma's interactive $transaction callback parameter.
 */
export type TenantTransactionClient = Parameters<
  Parameters<typeof prisma['$transaction']>[0]
>[0];

/**
 * Executes a database operation within an interactive transaction scoped to a validated tenant context.
 *
 * Security Contract:
 * 1. Invokes PL/pgSQL function `set_tenant_context(actorId, tenantId)` using parameterized raw SQL.
 * 2. `set_tenant_context()` validates actor membership in `user_actors` and sets transaction-scoped GUCs
 *    (`app.current_tenant_id` and `app.current_actor_id`) via `set_config(..., true)` (SET LOCAL).
 * 3. `queryBlock` MUST execute queries using the provided transaction client `tx` (not global `prisma`).
 * 4. If `set_tenant_context()` fails or throws a security exception, the transaction is automatically
 *    rolled back and the error is propagated (Fail-Closed).
 *
 * @param actorId Authenticated actor UUID from server-side JWT/session
 * @param tenantId Authenticated tenant UUID from server-side JWT/session
 * @param queryBlock Callback function receiving the tenant-scoped transaction client
 */
export async function runInTenantContext<T>(
  actorId: string,
  tenantId: string,
  queryBlock: (tx: TenantTransactionClient) => Promise<T>
): Promise<T> {
  if (!actorId || !tenantId) {
    throw new Error('SECURITY ERROR: Actor ID and Tenant ID are required for tenant context execution.');
  }

  return await prisma.$transaction(async (tx) => {
    // 1. Parameterized execution of set_tenant_context PL/pgSQL helper
    // Uses PostgreSQL $1, $2 query parameters under the hood via Prisma template tag
    await tx.$executeRaw`SELECT set_tenant_context(${actorId}::uuid, ${tenantId}::uuid);`;

    // 2. Execute business query logic within the active transaction
    return await queryBlock(tx);
  });
}
