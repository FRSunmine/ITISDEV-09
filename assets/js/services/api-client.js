import { appConfig } from "../config/app-config.js";

export class ApiError extends Error {
    constructor(message, { status = 0, details = null } = {}) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.details = details;
    }
}

export class ApiClient {
    constructor({ baseUrl = appConfig.apiBaseUrl, timeoutMs = appConfig.requestTimeoutMs } = {}) {
        this.baseUrl = baseUrl.replace(/\/$/, "");
        this.timeoutMs = timeoutMs;
    }

    get(path, options = {}) {
        return this.request(path, { ...options, method: "GET" });
    }

    post(path, body, options = {}) {
        return this.request(path, { ...options, method: "POST", body });
    }

    async request(path, { method = "GET", body, headers = {}, signal } = {}) {
        const timeoutController = new AbortController();
        const timeoutId = setTimeout(() => timeoutController.abort(), this.timeoutMs);
        const combinedSignal = signal
            ? AbortSignal.any([signal, timeoutController.signal])
            : timeoutController.signal;

        try {
            const response = await fetch(`${this.baseUrl}/${path.replace(/^\//, "")}`, {
                method,
                credentials: "include",
                headers: {
                    Accept: "application/json",
                    ...(body === undefined ? {} : { "Content-Type": "application/json" }),
                    ...headers,
                },
                body: body === undefined ? undefined : JSON.stringify(body),
                signal: combinedSignal,
            });

            const contentType = response.headers.get("content-type") ?? "";
            const payload = contentType.includes("application/json")
                ? await response.json()
                : await response.text();

            if (!response.ok) {
                throw new ApiError(`Request failed with status ${response.status}.`, {
                    status: response.status,
                    details: payload,
                });
            }

            return payload;
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }
            if (error.name === "AbortError") {
                throw new ApiError("The request timed out or was cancelled.");
            }
            throw new ApiError("The API could not be reached.", { details: error });
        } finally {
            clearTimeout(timeoutId);
        }
    }
}

export const apiClient = new ApiClient();
