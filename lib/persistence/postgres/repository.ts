import { parseServerEnv } from "@/lib/env";
import { createDatabase } from "@/lib/persistence/postgres/database";
import { DrizzleConversationRepository } from "@/lib/persistence/postgres/drizzle-conversation-repository";

let repository: DrizzleConversationRepository | undefined;

export function getConversationRepository(): DrizzleConversationRepository {
  if (repository) return repository;

  const { DATABASE_URL } = parseServerEnv();
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is required for conversation persistence.");
  }

  repository = new DrizzleConversationRepository(createDatabase(DATABASE_URL));
  return repository;
}
