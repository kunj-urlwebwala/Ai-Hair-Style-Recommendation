import http from "http";
import type { AddressInfo } from "net";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Isolate the test database and JWT secret from the developer's .env values.
const tempDir = mkdtempSync(path.join(tmpdir(), "mirror-api-"));
process.env.DATABASE_URL = `file:${path.join(tempDir, "api-test.sqlite")}`;
process.env.JWT_SECRET ??= "test-secret-for-vitest-only";

type AppModule = typeof import("../server/_core/app");

let appModule: AppModule;
let baseUrl: string;
let server: http.Server;

async function listen(app: import("express").Express): Promise<string> {
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

beforeAll(async () => {
  appModule = await import("../server/_core/app");
  baseUrl = await listen(appModule.createApiServer());
});

afterAll(async () => {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  const db = await import("../server/db");
  await db.closeDatabase();
  try {
    rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // Windows can hold the SQLite file briefly after close; the temp dir is cleaned by the OS anyway.
  }
});

async function post(pathname: string, body: unknown, token?: string) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  return { status: response.status, json: (await response.json().catch(() => null)) as any };
}

async function get(pathname: string, token?: string) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  return { status: response.status, json: (await response.json().catch(() => null)) as any };
}

describe("local auth flow", () => {
  it("registers a new account and starts a session", async () => {
    const email = `flow-${Date.now()}@example.com`;
    const { status, json } = await post("/api/auth/register", {
      name: "Flow Test",
      email,
      password: "password123",
    });

    expect(status).toBe(201);
    expect(json.sessionToken).toBeTruthy();
    expect(json.user.email).toBe(email);
  });

  it("rejects duplicate registrations", async () => {
    const email = `dup-${Date.now()}@example.com`;
    await post("/api/auth/register", { name: "Dup", email, password: "password123" });
    const second = await post("/api/auth/register", { name: "Dup again", email, password: "password123" });

    expect(second.status).toBe(409);
  });

  it("logs in with correct credentials only", async () => {
    const email = `login-${Date.now()}@example.com`;
    await post("/api/auth/register", { name: "Login", email, password: "password123" });

    const wrong = await post("/api/auth/login", { email, password: "wrong-pass" });
    expect(wrong.status).toBe(401);

    const ok = await post("/api/auth/login", { email, password: "password123" });
    expect(ok.status).toBe(200);
    expect(ok.json.user?.email).toBe(email);
  });

  it("resolves /api/auth/me from a Bearer session", async () => {
    const email = `me-${Date.now()}@example.com`;
    const registered = await post("/api/auth/register", { name: "Me", email, password: "password123" });

    const me = await get("/api/auth/me", registered.json.sessionToken);
    expect(me.status).toBe(200);
    expect(me.json.user?.email).toBe(email);

    const anonymous = await get("/api/auth/me");
    expect(anonymous.status).toBe(401);
  });
});

describe("protected AI endpoints", () => {
  it("rejects consultations without a session", async () => {
    const { status, json } = await post("/api/v1/hairstyle/consultations", {
      image: { base64: "x".repeat(200), mimeType: "image/jpeg" },
    });

    expect(status).toBe(401);
    expect(json.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects saved-look listing without a session", async () => {
    const response = await fetch(`${baseUrl}/api/v1/hairstyle/saved-looks`);
    expect(response.status).toBe(401);
  });

  it("still exposes health without a session", async () => {
    const v1 = await get("/api/v1/health");
    expect(v1.json.data.status).toBe("ok");

    const basic = await get("/api/health");
    expect(basic.json.ok).toBe(true);
  });
});

describe("password reset endpoints", () => {
  it("answers forgot-password consistently even for unknown emails", async () => {
    const { status, json } = await post("/api/auth/forgot-password", {
      email: `nobody-${Date.now()}@example.com`,
    });

    expect(status).toBe(200);
    expect(json.success).toBe(true);
  });

  it("rejects malformed reset payloads", async () => {
    const { status } = await post("/api/auth/reset-password", {
      email: "someone@example.com",
      otp: "12",
      password: "password123",
    });
    expect(status).toBe(400);
  });
});
