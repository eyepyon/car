import type { LicensePlateData } from "@/types/license-plate";

const FIELD_MODULUS = BigInt(
  "21888242871839275222246405745257275088548364400416034343698204186575808495617",
);

function ensureField(value: bigint): bigint {
  const normalized = value % FIELD_MODULUS;
  return normalized >= 0n ? normalized : normalized + FIELD_MODULUS;
}

function codePointToField(char: string): bigint {
  const codePoint = char.codePointAt(0);
  if (codePoint === undefined) {
    throw new Error("無効な文字が含まれています");
  }
  return ensureField(BigInt(codePoint));
}

/**
 * LicensePlateDataをZK回路向けのplateChars[8]へ変換する
 *
 * 仕様:
 * - region(最大2文字)はUTF-8コードポイントをそのまま使用
 * - classificationNumber(数値)を1要素で保持
 * - hiragana(1文字)はコードポイントを使用
 * - serialNumber(数値)を1要素で保持
 * - 残りは0でパディング
 */
export function encodeLicensePlateToChars(data: LicensePlateData): bigint[] {
  const chars: bigint[] = [];
  const regionChars = Array.from(data.region);

  if (regionChars.length > 2) {
    throw new Error("地域名が長すぎます（最大2文字）");
  }

  for (const char of regionChars) {
    chars.push(codePointToField(char));
  }

  const classification = Number.parseInt(data.classificationNumber, 10);
  if (Number.isNaN(classification)) {
    throw new Error("分類番号が数値ではありません");
  }
  chars.push(ensureField(BigInt(classification)));

  chars.push(codePointToField(data.hiragana));

  const serial = Number.parseInt(data.serialNumber, 10);
  if (Number.isNaN(serial)) {
    throw new Error("一連番号が数値ではありません");
  }
  chars.push(ensureField(BigInt(serial)));

  if (chars.length > 8) {
    throw new Error("ナンバープレートの要素数が多すぎます");
  }

  while (chars.length < 8) {
    chars.push(0n);
  }

  return chars;
}

export function createRandomFieldSalt(): bigint {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = `0x${Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;
  return ensureField(BigInt(hex));
}
