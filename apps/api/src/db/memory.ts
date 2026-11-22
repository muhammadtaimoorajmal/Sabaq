/**
 * A throwaway MongoDB server that runs on this machine, used by tests and by local development
 * when no MONGODB_URI is configured. Its data disappears when it stops.
 * The MongoDB binary is downloaded once, on first use, and cached.
 */
export async function startMemoryDatabase(): Promise<{ uri: string; stop: () => Promise<void> }> {
  const { MongoMemoryServer } = await import('mongodb-memory-server-core');
  const server = await MongoMemoryServer.create();
  return {
    uri: server.getUri(),
    stop: async () => {
      await server.stop();
    },
  };
}
