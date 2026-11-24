import { describe, expect, test } from "bun:test";
import {
  ADDRESS_NEEDS_HTTPS,
  ADDRESS_NOT_VALID,
  plainHttpAllowed,
  serverOrigin,
} from "../src/server-address";

describe("plainHttpAllowed", () => {
  test.each([
    "10.0.0.1",
    "10.255.255.255",
    "127.0.0.1",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.4.42",
    "100.64.0.0",
    "100.96.0.1",
    "100.127.255.255",
    "[::1]",
  ])("allows %s", (host) => {
    expect(plainHttpAllowed(host)).toBe(true);
  });

  test.each([
    "8.8.8.8",
    "172.15.0.1",
    "172.32.0.1",
    "192.169.0.1",
    "100.63.255.255",
    "100.128.0.0",
    "100.1.2.3",
    "localhost",
    "mac.tailnet.ts.net",
    "openbot.local",
    "[2001:db8::1]",
    "10.0.0",
    "10.0.0.256",
    "010.0.0.1",
  ])("refuses %s", (host) => {
    expect(plainHttpAllowed(host)).toBe(false);
  });
});

describe("serverOrigin", () => {
  test("assumes http and drops a path", () => {
    expect(serverOrigin(" 100.96.0.1:13001/ ")).toBe(
      "http://100.96.0.1:13001",
    );
    expect(serverOrigin("http://192.168.1.20:3001/api")).toBe(
      "http://192.168.1.20:3001",
    );
  });

  test("keeps https for any name", () => {
    expect(serverOrigin("https://openbot.example.com")).toBe(
      "https://openbot.example.com",
    );
  });

  test("needs https for a name or a public address", () => {
    expect(() => serverOrigin("openbot.example.com")).toThrow(
      ADDRESS_NEEDS_HTTPS,
    );
    expect(() => serverOrigin("http://mac.tailnet.ts.net:3001")).toThrow(
      ADDRESS_NEEDS_HTTPS,
    );
    expect(() => serverOrigin("http://100.1.2.3")).toThrow(ADDRESS_NEEDS_HTTPS);
  });

  test("refuses what isn't an address", () => {
    expect(() => serverOrigin("")).toThrow(ADDRESS_NOT_VALID);
    expect(() => serverOrigin("ftp://10.0.0.1")).toThrow(ADDRESS_NOT_VALID);
    expect(() => serverOrigin("http://user:pw@10.0.0.1")).toThrow(
      ADDRESS_NOT_VALID,
    );
    expect(() => serverOrigin("http://10.0.0.1/?token=x")).toThrow(
      ADDRESS_NOT_VALID,
    );
  });
});
