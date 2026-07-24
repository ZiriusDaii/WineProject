-- RenameValue (Postgres-native enum rename, no data loss -- existing rows
-- already using the old label move with it automatically)
ALTER TYPE "ServiceGender" RENAME VALUE 'NINOS' TO 'Niños';
