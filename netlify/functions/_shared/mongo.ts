import { type Db, MongoClient } from "mongodb";

// One client per URI per warm container. A failed connect is evicted so the next call retries.
const clients = new Map<string, Promise<MongoClient>>();

function connect(envName: string): Promise<MongoClient> {
  const uri = process.env[envName];
  if (!uri) throw new Error(`${envName} not set`);
  let client = clients.get(uri);
  if (!client) {
    client = new MongoClient(uri, { maxPoolSize: 1, maxIdleTimeMS: 60_000, serverSelectionTimeoutMS: 10_000 })
      .connect()
      .catch((err) => {
        clients.delete(uri);
        throw err;
      });
    clients.set(uri, client);
  }
  return client;
}

/** DB name comes from the URI path, as calendar's mongoose connection does. */
export const calendarDb = async (): Promise<Db> => (await connect("CALENDAR_MONGODB_URI")).db();

export const praiseDb = async (): Promise<Db> =>
  (await connect("PRAISE_MONGODB_URI")).db(process.env.PRAISE_MONGODB_DB || "praise_presenter");
