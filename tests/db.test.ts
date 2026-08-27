import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Point the database layer at a throwaway file before importing it.
const tempDir = mkdtempSync(path.join(tmpdir(), "mirror-db-"));
process.env.DATABASE_URL = `file:${path.join(tempDir, "test.sqlite")}`;

const db = await import("../server/db");
const { createUser, getPendingResetOtp, createPasswordResetOtp } = db;

afterAll(async () => {
  await db.closeDatabase();
  rmSync(tempDir, { recursive: true, force: true });
});

describe("database layer", () => {
  let userId: number;

  it("creates and fetches users by email (case-insensitive)", async () => {
    const user = await createUser({
      email: "Db.Test@Example.com",
      name: "DB Test",
      passwordHash: "scrypt:salt:digest",
    });
    userId = user.id;

    const fetched = await db.getUserByEmail("db.test@example.com");
    expect(fetched?.id).toBe(userId);
    expect((await db.getUserById(userId))?.name).toBe("DB Test");
  });

  it("stores consultations against the owning user", async () => {
    await db.createConsultationRecord({
      id: "con_test000001",
      userId,
      sourceImagePath: "/uploads/consultations/con_test000001.jpg",
      requirements: { occasion: "wedding" },
      analysis: {
        faceShape: "Oval",
        overview: "Balanced frame.",
        featureNotes: ["a", "b", "c"],
        stylePrinciples: ["x", "y", "z"],
        confidenceNote: "Visual guidance.",
      },
      recommendations: [],
      analysisModel: "gemini-test",
    });

    const records = await db.listConsultationsByUser(userId);
    expect(records).toHaveLength(1);
    expect(records[0]?.requirements).toEqual({ occasion: "wedding" });
    expect(records[0]?.analysis.faceShape).toBe("Oval");
  });

  it("saves, lists, and removes saved looks per user", async () => {
    const look = await db.createSavedLook({
      id: "look_test0001",
      userId,
      consultationId: "con_test000001",
      recommendation: {
        id: "bridal-low-bun",
        name: "Bridal low bun",
        description: "desc",
        whyItWorks: "why",
        maintenance: "Low",
        texture: "Sleek",
        tone: "Wedding",
        prompt: "prompt text",
      },
      previewImageUrl: "/uploads/generated/preview.png",
    });

    expect(await db.listSavedLooksByUser(userId)).toHaveLength(1);
    expect(await db.deleteSavedLook(userId, look.id)).toBe(true);
    expect(await db.deleteSavedLook(userId, look.id)).toBe(false);
  });

  it("invalidates older reset codes when a new one is issued", async () => {
    await createPasswordResetOtp(
      "db.test@example.com",
      "hash-old",
      Date.now() + 60_000,
    );
    await createPasswordResetOtp(
      "db.test@example.com",
      "hash-new",
      Date.now() + 60_000,
    );

    const pending = await getPendingResetOtp("db.test@example.com");
    expect(pending?.otpHash).toBe("hash-new");

    await db.consumeResetOtp(pending!.id);
    expect(await getPendingResetOtp("db.test@example.com")).toBeUndefined();
  });
});
