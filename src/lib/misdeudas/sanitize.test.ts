import assert from "node:assert/strict";
import test from "node:test";
import { cleanText } from "./money.ts";
import { stripControlCharacters } from "./sanitize.ts";

test("removes C0 and C1 control characters while preserving Unicode text", () => {
  assert.equal(stripControlCharacters("Ana\u0000\tLópez\u007f\u0085 ✨"), "AnaLópez ✨");
});

test("cleanText strips controls, trims, and respects the maximum length", () => {
  assert.equal(cleanText("  Mis\u0000 deudas\n  ", 5), "Mis d");
});
