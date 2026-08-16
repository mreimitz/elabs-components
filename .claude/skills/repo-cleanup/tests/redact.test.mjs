import assert from "node:assert/strict";
import { test } from "node:test";
import { isSecretBearingPath, redact, redactDeep, redactWithStats } from "../scripts/redact.mjs";

// Synthetic values only. None of these is a real credential; the point of every
// assertion below is that the literal must NOT survive into output.
const CASES = [
  ["github classic", "ghp_0123456789abcdefghijABCDEFGHIJ0123"],
  ["github fine-grained", "github_pat_11ABCDEFG0abcdefghijkl_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345"],
  ["anthropic", "sk-ant-api03-AAAAbbbbCCCCddddEEEEffff"],
  ["aws access key", "AKIAIOSFODNN7EXAMPLE"],
  // AIza + exactly 35 chars — a shorter stand-in silently tests nothing.
  ["google api key", "AIzaSyA00000000000000000000000000000000"],
  ["npm token", "npm_abcdefghijklmnopqrstuvwxyz0123456789"],
  ["slack", "xoxb-000000000000-000000000000-abcdefghijklmnopqrstuvwx"],
  [
    "jwt",
    "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk",
  ],
];

for (const [name, secret] of CASES) {
  test(`redacts ${name}`, () => {
    const out = redact(`value: ${secret} trailing`);
    assert.ok(!out.includes(secret), `${name} survived redaction`);
    assert.match(out, /\[REDACTED:/);
    assert.match(out, /trailing/, "redaction ate surrounding text");
  });
}

test("redacts a private key block whole, not line by line", () => {
  const key = [
    "-----BEGIN RSA PRIVATE KEY-----",
    "MIIEowIBAAKCAQEA1234",
    "abcd",
    "-----END RSA PRIVATE KEY-----",
  ].join("\n");
  const out = redact(`before\n${key}\nafter`);
  assert.ok(!out.includes("MIIEowIBAAKCAQEA1234"));
  assert.ok(!out.includes("BEGIN RSA PRIVATE KEY"));
  assert.match(out, /before/);
  assert.match(out, /after/);
});

test("redacts assignment forms while keeping the key name", () => {
  const out = redact("//npm.pkg.github.com/:_authToken=abcd1234efgh5678ijkl");
  assert.ok(!out.includes("abcd1234efgh5678ijkl"));
  assert.match(out, /_authToken=/, "the key name is information we want to keep");
});

test("redacts URL userinfo but keeps the scheme", () => {
  const out = redact("clone https://user:hunter2hunter2@github.com/org/repo.git");
  assert.ok(!out.includes("hunter2hunter2"));
  assert.match(out, /^clone https:\/\//);
});

test("redacts connection strings", () => {
  const out = redact("DB=postgres://admin:s3cretPassw0rd@db.internal:5432/app");
  assert.ok(!out.includes("s3cretPassw0rd"));
});

test("placeholder leaks no prefix of the value", () => {
  const secret = "ghp_ZZZZ111122223333444455556666777788";
  const out = redact(secret);
  // Four characters is already enough to shortlist a token; assert none leak.
  for (let n = 4; n <= 12; n++) {
    assert.ok(!out.includes(secret.slice(0, n)), `leaked a ${n}-char prefix`);
  }
});

test("does not redact ordinary prose or paths", () => {
  const inputs = [
    "The always-loaded footprint is 34437 bytes across 9 files.",
    "src/main/transport/wire-history.ts:42",
    "pnpm typecheck && pnpm test && pnpm lint",
    "commit 8caff7e merged on 2026-08-02",
    "https://github.com/org/repo/pull/12",
  ];
  for (const s of inputs) {
    assert.equal(redact(s), s, `false positive on: ${s}`);
  }
});

test("prose containing secret-ish WORDS is left alone", () => {
  // Regression: an earlier pattern accepted plain whitespace as an assignment
  // separator, so this report's own header — "Token figures marked (estimate)"
  // — was rewritten to "Token [REDACTED] marked". Over-redaction destroys the
  // output; it is not the safe side of the trade.
  const prose = [
    "Token figures marked (estimate) come from a chars / 4 heuristic.",
    "The auth handshake is env-less and argv-less.",
    "Password rotation policy lives with the owner.",
    "A missing token returns 404 rather than 401.",
    "secret scanning happens by filename, never by opening the file",
    "This api key discussion belongs in the security review.",
  ];
  for (const s of prose) {
    assert.equal(redact(s), s, `over-redacted ordinary prose: ${s}`);
  }
});

test("real assignments and CLI flags are still redacted", () => {
  const cases = [
    ["token=abcdef123456", "abcdef123456"],
    ['"password": "hunter2hunter2"', "hunter2hunter2"],
    ["API_KEY = sk_live_abcdef123456", "sk_live_abcdef123456"],
    ["--auth-token abcdef123456", "abcdef123456"],
    ["//npm.pkg.github.com/:_authToken=abcd1234efgh5678", "abcd1234efgh5678"],
  ];
  for (const [input, secret] of cases) {
    const out = redact(input);
    assert.ok(!out.includes(secret), `missed a real secret in: ${input}`);
    assert.match(out, /\[REDACTED/);
  }
});

test("reports which patterns fired", () => {
  const { hits } = redactWithStats(
    "a ghp_0123456789abcdefghijABCDEFGHIJ0123 b AKIAIOSFODNN7EXAMPLE",
  );
  assert.equal(hits["github-token"], 1);
  assert.equal(hits["aws-access-key"], 1);
});

test("redactDeep redacts values but never keys", () => {
  const out = redactDeep({
    password: "ghp_0123456789abcdefghijABCDEFGHIJ0123",
    nested: { list: ["AKIAIOSFODNN7EXAMPLE", "plain"] },
    count: 3,
  });
  assert.ok(Object.hasOwn(out, "password"), "object keys are structure, not secrets");
  assert.ok(!JSON.stringify(out).includes("ghp_0123456789"));
  assert.ok(!JSON.stringify(out).includes("AKIAIOSFODNN7EXAMPLE"));
  assert.equal(out.nested.list[1], "plain");
  assert.equal(out.count, 3);
});

test("secret-bearing paths are detected by name, never opened", () => {
  for (const p of [".env", ".env.local", "certs/server.pem", "a/b/id_rsa", ".npmrc", "app.key"]) {
    assert.ok(isSecretBearingPath(p), `${p} should be flagged`);
  }
  for (const p of [".env.example.md", "src/keyboard.ts", "README.md"]) {
    assert.ok(!isSecretBearingPath(p), `${p} should not be flagged`);
  }
});

test("redact is total: empty and non-string inputs do not throw", () => {
  assert.equal(redact(""), "");
  assert.equal(redact(undefined), "");
  assert.equal(redact(null), "");
});
