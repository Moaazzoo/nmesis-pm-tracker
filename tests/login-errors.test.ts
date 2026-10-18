import { describe, it, expect } from "vitest";
import { loginErrorCode } from "@/lib/login-errors";

describe("loginErrorCode", () => {
  it("maps a wrong password to 'invalid'", () => {
    expect(loginErrorCode("Invalid login credentials")).toBe("invalid");
  });
  it("maps a rejected API key to 'config' so a broken deploy is not mistaken for a wrong password", () => {
    expect(loginErrorCode("Invalid API key")).toBe("config");
  });
  it("maps a disabled email provider to 'disabled'", () => {
    expect(loginErrorCode("Email logins are disabled")).toBe("disabled");
  });
  it("maps an unconfirmed email to 'unconfirmed'", () => {
    expect(loginErrorCode("Email not confirmed")).toBe("unconfirmed");
  });
  it("maps rate limiting to 'rate'", () => {
    expect(loginErrorCode("Request rate limit reached")).toBe("rate");
  });
  it("maps anything else to 'other'", () => {
    expect(loginErrorCode("fetch failed")).toBe("other");
  });
});
