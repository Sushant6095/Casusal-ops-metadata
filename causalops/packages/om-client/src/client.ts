import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  AxiosError,
} from "axios";

/** Normalized OpenMetadata API error. */
export class OmApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly requestId: string | undefined;

  constructor(params: {
    status: number;
    code: string;
    message: string;
    requestId?: string | undefined;
  }) {
    super(params.message);
    this.name = "OmApiError";
    this.status = params.status;
    this.code = params.code;
    this.requestId = params.requestId;
  }
}

export interface OmClientOptions {
  host: string;
  token: string;
  timeout?: number;
  maxRetries?: number;
  retryBaseMs?: number;
}

export interface OmClient {
  readonly http: AxiosInstance;
  readonly host: string;
}

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_BASE_MS = 200;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Create a configured OpenMetadata HTTP client. */
export function createOmClient(opts: OmClientOptions): OmClient {
  const baseURL = `${opts.host.replace(/\/$/, "")}/api/v1`;
  const maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
  const retryBaseMs = opts.retryBaseMs ?? DEFAULT_RETRY_BASE_MS;

  const http = axios.create({
    baseURL,
    timeout: opts.timeout ?? DEFAULT_TIMEOUT_MS,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });

  http.interceptors.request.use((config) => {
    config.headers.set("Authorization", `Bearer ${opts.token}`);
    return config;
  });

  http.interceptors.response.use(
    (res: AxiosResponse) => res,
    async (error: AxiosError<{ code?: number; message?: string }>) => {
      const cfg = error.config as
        | (AxiosRequestConfig & { __retryCount?: number })
        | undefined;
      const status = error.response?.status ?? 0;

      if (cfg && status >= 500 && status < 600) {
        cfg.__retryCount = (cfg.__retryCount ?? 0) + 1;
        if (cfg.__retryCount <= maxRetries) {
          const delay = retryBaseMs * 2 ** (cfg.__retryCount - 1);
          await sleep(delay);
          return http.request(cfg);
        }
      }

      const body = error.response?.data;
      const message =
        (typeof body === "object" && body && "message" in body
          ? String(body.message)
          : undefined) ??
        error.message ??
        "OpenMetadata request failed";
      const code =
        typeof body === "object" && body && "code" in body
          ? String(body.code)
          : error.code ?? "OM_UNKNOWN";
      const requestId =
        (error.response?.headers?.["x-request-id"] as string | undefined) ??
        undefined;

      throw new OmApiError({ status, code, message, requestId });
    },
  );

  return { http, host: opts.host };
}
