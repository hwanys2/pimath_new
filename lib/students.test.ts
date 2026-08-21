import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  compareStudentsByNumber,
  formatStudentLabel,
  parseRosterText,
  parseStudentNumber,
} from "@/lib/students";

describe("parseStudentNumber", () => {
  it("accepts 1–999 and empty", () => {
    assert.deepEqual(parseStudentNumber(""), { value: null });
    assert.deepEqual(parseStudentNumber("7"), { value: 7 });
    assert.deepEqual(parseStudentNumber(12), { value: 12 });
  });

  it("rejects non-digits and out of range", () => {
    assert.equal(parseStudentNumber("1번").error != null, true);
    assert.equal(parseStudentNumber("0").error != null, true);
    assert.equal(parseStudentNumber("1000").error != null, true);
  });
});

describe("parseRosterText", () => {
  it("parses numbered CSV with header", () => {
    const rows = parseRosterText(
      "번호,이름,아이디,비밀번호\n1,김민수,minsu01,1234\n2,이서연,seoyeon,abcd",
    );
    assert.equal(rows.length, 2);
    assert.deepEqual(rows[0].studentNumber, 1);
    assert.equal(rows[0].displayName, "김민수");
    assert.equal(rows[0].loginId, "minsu01");
    assert.equal(rows[0].error, undefined);
    assert.equal(rows[1].studentNumber, 2);
  });

  it("parses legacy 3-column rows without a number", () => {
    const rows = parseRosterText("김민수,minsu01,1234");
    assert.equal(rows.length, 1);
    assert.equal(rows[0].studentNumber, null);
    assert.equal(rows[0].displayName, "김민수");
    assert.equal(rows[0].loginId, "minsu01");
  });

  it("parses 4-column TSV without header as 번호 first", () => {
    const rows = parseRosterText("3\t박하늘\thaneul\tpw");
    assert.equal(rows[0].studentNumber, 3);
    assert.equal(rows[0].displayName, "박하늘");
    assert.equal(rows[0].loginId, "haneul");
    assert.equal(rows[0].password, "pw");
  });
});

describe("compareStudentsByNumber", () => {
  it("orders by number then name, with missing numbers last", () => {
    const rows = [
      { studentNumber: null, displayName: "가" },
      { studentNumber: 2, displayName: "나" },
      { studentNumber: 1, displayName: "다" },
    ].sort(compareStudentsByNumber);
    assert.deepEqual(
      rows.map((r) => r.displayName),
      ["다", "나", "가"],
    );
  });
});

describe("formatStudentLabel", () => {
  it("prefixes 번 when a number exists", () => {
    assert.equal(formatStudentLabel("김민수", 1), "1번 김민수");
    assert.equal(formatStudentLabel("김민수", null), "김민수");
  });
});
