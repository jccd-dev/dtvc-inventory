I will seamlessly migrate your database from local SQLite to Neon (PostgreSQL) by updating the Prisma configuration and connection logic.

### 1. Update Dependencies
- **Remove** SQLite-specific packages (`better-sqlite3`, `@prisma/adapter-better-sqlite3`) that are no longer needed.
- **Note**: Standard Prisma Client works natively with PostgreSQL/Neon, so no new heavy drivers are required for this configuration.

### 2. Configure Environment
- **Update `.env`**: Set the `DATABASE_URL` to your provided Neon connection string.
- **Secure Credentials**: Ensure the connection string is stored securely in the environment file.

### 3. Update Prisma Configuration
- **Modify `schema.prisma`**: Switch the datasource provider from `"sqlite"` to `"postgresql"`.
- **Refactor `src/lib/prisma.ts`**: Remove the SQLite adapter logic and revert to the standard, robust `PrismaClient` initialization which is fully compatible with Neon.

### 4. Apply Database Schema
- **Reset Migrations**: Remove old SQLite-specific migration files.
- **Initialize Neon DB**: Run `npx prisma migrate dev` to create your tables in the new Neon database.

### 5. Verify Integration
- **Start Application**: Launch the dev server.
- **Test Connectivity**: Verify that the inventory list loads (it will be empty initially) and that new items can be added, confirming the read/write connection to Neon.
