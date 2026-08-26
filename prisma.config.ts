import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  // Path to the verified Prisma schema
  schema: './prisma/schema.prisma',

  // Path to the migration directory containing manual security DDL
  migrations: {
    path: 'prisma/migrations',
  },

  // Connection settings using the migration DDL Owner role credentials
  datasource: {
    url: env('MIGRATION_DATABASE_URL'),
  },
});
