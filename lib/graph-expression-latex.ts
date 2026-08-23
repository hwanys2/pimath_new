/** 그래프 탐구 표시용 식 → KaTeX LaTeX 변환 */

function convertPowers(s: string): string {
  let out = "";
  let i = 0;
  while (i < s.length) {
    if (s[i] === "^") {
      i++;
      if (s[i] === "(") {
        let depth = 1;
        let j = i + 1;
        while (j < s.length && depth > 0) {
          if (s[j] === "(") depth++;
          if (s[j] === ")") depth--;
          j++;
        }
        out += `^{${s.slice(i + 1, j - 1)}}`;
        i = j;
      } else if (/[0-9a-zA-Z]/.test(s[i] ?? "")) {
        out += `^{${s[i]}}`;
        i++;
      } else {
        out += "^";
      }
    } else {
      out += s[i];
      i++;
    }
  }
  return out;
}

function convertFractions(s: string): string {
  // a/b, (expr)/(expr), 6/x 등
  return s.replace(
    /(\d+(?:\.\d+)?|\([^()]+\))\/(\d+(?:\.\d+)?|\([^()]+\)|x)/g,
    (_, num, den) => `\\frac{${num}}{${den}}`,
  );
}

function convertSqrt(s: string): string {
  return s.replace(/sqrt\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)/gi, "\\sqrt{$1}");
}

function convertFunctions(s: string): string {
  return s
    .replace(/\barcsin\b/gi, "\\arcsin ")
    .replace(/\barccos\b/gi, "\\arccos ")
    .replace(/\barctan\b/gi, "\\arctan ")
    .replace(/\basin\b/gi, "\\arcsin ")
    .replace(/\bacos\b/gi, "\\arccos ")
    .replace(/\batan\b/gi, "\\arctan ")
    .replace(/\bsin\b/gi, "\\sin ")
    .replace(/\bcos\b/gi, "\\cos ")
    .replace(/\btan\b/gi, "\\tan ")
    .replace(/\babs\b/gi, "\\left|")
    .replace(/\bln\b/gi, "\\ln ")
    .replace(/\blog\b/gi, "\\log ")
    .replace(/\bpi\b/gi, "\\pi ")
    .replace(/π/g, "\\pi ");
}

/** `y = x^2` 같은 표시 문자열을 LaTeX로 변환 */
export function expressionDisplayToLatex(display: string): string {
  let s = display
    .trim()
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-");

  s = convertSqrt(s);
  s = convertFractions(s);
  s = convertPowers(s);
  s = convertFunctions(s);

  // 암시적 곱: 2x → 2x (LaTeX OK), 필요 시 2\cdot x
  return s;
}
