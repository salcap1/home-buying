import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("board passwords", () => {
  it("verifies a hashed password", () => {
    const stored = hashPassword("unique-board-secret");
    expect(verifyPassword("unique-board-secret", stored)).toBe(true);
    expect(verifyPassword("wrong", stored)).toBe(false);
  });

  it("rejects empty or malformed hashes", () => {
    expect(verifyPassword("x", "")).toBe(false);
    expect(verifyPassword("x", "not-a-hash")).toBe(false);
  });
});
