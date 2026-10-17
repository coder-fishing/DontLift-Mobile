import * as SQLite from 'expo-sqlite';
import { migrateLocalDatabase } from './migrations';

const DATABASE_NAME = 'dontlift.db';
let initialization: Promise<SQLite.SQLiteDatabase> | undefined;

export function getLocalDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (initialization) return initialization;

  const opening = SQLite.openDatabaseAsync(DATABASE_NAME).then(async (database) => {
    try {
      await migrateLocalDatabase(database);
      return database;
    } catch (error) {
      await database.closeAsync();
      throw error;
    }
  });

  initialization = opening;
  void opening.catch(() => {
    if (initialization === opening) initialization = undefined;
  });
  return opening;
}
