export type Fetcher = { fetch: (request: Request) => Promise<Response> };

export type DurableObjectId = { toString(): string };
export type DurableObjectState = {
  storage: {
    get<T>(key: string): Promise<T | undefined>;
    put<T>(key: string, value: T): Promise<void>;
    delete(key: string): Promise<boolean>;
  };
};

export type DurableObjectStub = { fetch: (request: Request) => Promise<Response> };
export type DurableObjectNamespace = {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub;
};

export type WorkerEnv = {
  ASSETS: Fetcher;
  CLOUDNAV_DB: DurableObjectNamespace;
  PASSWORD?: string;
  SESSION_SECRET?: string;
  USE_FAVICON_SERVICE?: string;
};

export type ExecutionContext = { waitUntil(promise: Promise<unknown>): void };
