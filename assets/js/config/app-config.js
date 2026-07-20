const runtimeConfig = globalThis.SIDEQUEST_CONFIG ?? {};

export const appConfig = Object.freeze({
    apiBaseUrl: runtimeConfig.apiBaseUrl ?? "/api/v1",
    requestTimeoutMs: runtimeConfig.requestTimeoutMs ?? 15_000,
});
