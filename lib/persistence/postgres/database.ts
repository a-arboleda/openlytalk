import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";

/**
 * Uses Neon's WebSocket-capable driver so repository operations can use
 * interactive transactions and row-level locking.
 */
export function createDatabase(databaseUrl: string) {
  return drizzle({
    connection: databaseUrl,
    ws,
  });
}

export type OpenlyTalkDatabase = ReturnType<typeof createDatabase>;
