import { parseServerEnv } from "@/lib/env";
import { createDatabase } from "@/lib/persistence/postgres/database";
import { DrizzlePracticeRepository } from "@/lib/persistence/postgres/drizzle-practice-repository";

let repository: DrizzlePracticeRepository | undefined;

export function getPracticeRepository(): DrizzlePracticeRepository {
  if (repository) return repository;

  const { DATABASE_URL } = parseServerEnv();
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is required for practice persistence.");
  }

  repository = new DrizzlePracticeRepository(createDatabase(DATABASE_URL));
  return repository;
}
