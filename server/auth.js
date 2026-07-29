import {
    createHash,
    randomBytes,
    scryptSync,
    timingSafeEqual,
} from "node:crypto";

const PASSWORD_KEY_LENGTH = 64;

export function hashPassword(password, salt = randomBytes(16).toString("hex")) {
    const hash = scryptSync(password, salt, PASSWORD_KEY_LENGTH).toString("hex");
    return `${salt}:${hash}`;
}

export function verifyPassword(password, storedValue) {
    const [salt, storedHash] = String(storedValue).split(":");
    if (!salt || !storedHash) return false;

    const candidate = scryptSync(password, salt, PASSWORD_KEY_LENGTH);
    const expected = Buffer.from(storedHash, "hex");
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export function createSessionToken() {
    return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token) {
    return createHash("sha256").update(token).digest("hex");
}

export function parseCookies(header = "") {
    return Object.fromEntries(
        header
            .split(";")
            .map((part) => part.trim())
            .filter(Boolean)
            .map((part) => {
                const separator = part.indexOf("=");
                const key = separator === -1 ? part : part.slice(0, separator);
                const value = separator === -1 ? "" : part.slice(separator + 1);
                return [decodeURIComponent(key), decodeURIComponent(value)];
            }),
    );
}

export function sessionCookie(token, { maxAgeSeconds, secure = false } = {}) {
    const attributes = [
        `sidequest_session=${encodeURIComponent(token)}`,
        "Path=/",
        "HttpOnly",
        "SameSite=Lax",
    ];
    if (maxAgeSeconds !== undefined) attributes.push(`Max-Age=${maxAgeSeconds}`);
    if (secure) attributes.push("Secure");
    return attributes.join("; ");
}

export function clearSessionCookie({ secure = false } = {}) {
    return sessionCookie("", { maxAgeSeconds: 0, secure });
}
