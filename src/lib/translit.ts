/**
 * Converts modern Uzbek Latin-script text to Uzbek Cyrillic script, per the
 * official 1995 Latin<->Cyrillic correspondence. Only Latin-Uzbek letters are
 * touched; digits, punctuation, already-Cyrillic text, and non-letter runs
 * pass through unchanged, so it's safe to run on text that mixes Uzbek words
 * with numbers or Latin abbreviations (e.g. "PDF", "1-avgust").
 *
 * Key rules implemented:
 * - o', g' (any apostrophe variant: ' ʻ ʼ ’) -> ў, ғ
 * - sh, ch, ng -> ш, ч, нг
 * - y + {a,u,o,e} -> я, ю, ё, е (e.g. "yoqilg'i" -> "ёқилғи")
 * - y not followed by a vowel -> й (e.g. "reys" -> "рейс")
 * - e at the start of a word, or right after a vowel -> э (e.g. "Egasi" -> "Эгаси")
 * - e elsewhere -> е
 * - capitalization of the first letter of each transliterated word is preserved
 */

const VOWELS = new Set(["a", "e", "i", "o", "u"]);
const APOSTROPHES = new Set(["'", "ʻ", "ʼ", "’", "`"]);

const SINGLE_LETTERS: Record<string, string> = {
  a: "а",
  b: "б",
  d: "д",
  f: "ф",
  g: "г",
  h: "ҳ",
  i: "и",
  j: "ж",
  k: "к",
  l: "л",
  m: "м",
  n: "н",
  o: "о",
  p: "п",
  q: "қ",
  r: "р",
  s: "с",
  t: "т",
  u: "у",
  v: "в",
  x: "х",
  z: "з",
};

const IOTATED: Record<string, string> = { a: "я", u: "ю", o: "ё", e: "е" };

function isLetterOrApostrophe(ch: string | undefined): boolean {
  if (!ch) return false;
  return /[a-zA-Z]/.test(ch) || APOSTROPHES.has(ch);
}

function transliterateWord(word: string): string {
  const lower = word.toLowerCase();
  let out = "";
  let i = 0;
  let prevWasVowel = false;

  while (i < lower.length) {
    const c = lower[i];
    const c2 = lower.slice(i, i + 2);

    if ((c === "o" || c === "g") && APOSTROPHES.has(lower[i + 1] ?? "")) {
      out += c === "o" ? "ў" : "ғ";
      i += 2;
      prevWasVowel = false;
      continue;
    }
    if (c2 === "sh") {
      out += "ш";
      i += 2;
      prevWasVowel = false;
      continue;
    }
    if (c2 === "ch") {
      out += "ч";
      i += 2;
      prevWasVowel = false;
      continue;
    }
    // "n" right before a g' unit (e.g. "boshlang'ich") is a plain н — the g'
    // belongs to the NEXT letter-pair, not to an "ng" digraph with this n.
    const nextStartsGApostrophe = c === "n" && lower[i + 1] === "g" && APOSTROPHES.has(lower[i + 2] ?? "");
    if (c2 === "ng" && !nextStartsGApostrophe) {
      out += "нг";
      i += 2;
      prevWasVowel = false;
      continue;
    }
    if (c === "y") {
      const next = lower[i + 1];
      // "o" right before an apostrophe is really the start of the o' (ў) unit,
      // not a plain vowel to iotate — e.g. "yo'l" is y + o' (йўл), not yo + 'l.
      const nextStartsApostropheLetter = next === "o" && APOSTROPHES.has(lower[i + 2] ?? "");
      if (next && IOTATED[next] && !nextStartsApostropheLetter) {
        out += IOTATED[next];
        i += 2;
        prevWasVowel = true;
        continue;
      }
      out += "й";
      i += 1;
      prevWasVowel = false;
      continue;
    }
    if (c === "e") {
      out += i === 0 || prevWasVowel ? "э" : "е";
      i += 1;
      prevWasVowel = true;
      continue;
    }
    if (SINGLE_LETTERS[c]) {
      out += SINGLE_LETTERS[c];
      i += 1;
      prevWasVowel = VOWELS.has(c);
      continue;
    }
    if (APOSTROPHES.has(c)) {
      // A bare apostrophe not attached to o/g is the tutuq belgisi (glottal stop).
      out += "ъ";
      i += 1;
      prevWasVowel = false;
      continue;
    }
    // Unknown character inside a "word" token (shouldn't normally happen) — keep as-is.
    out += lower[i];
    i += 1;
    prevWasVowel = false;
  }

  // Preserve the first letter's case; the rest of Uzbek Cyrillic prose is
  // lowercase outside acronyms, which this function isn't meant to handle.
  if (word[0] && word[0] === word[0].toUpperCase() && /[a-zA-Z]/.test(word[0])) {
    return out.charAt(0).toUpperCase() + out.slice(1);
  }
  return out;
}

export function latinToCyrillic(input: string): string {
  let result = "";
  let i = 0;
  while (i < input.length) {
    if (isLetterOrApostrophe(input[i])) {
      let j = i;
      while (j < input.length && isLetterOrApostrophe(input[j])) j++;
      result += transliterateWord(input.slice(i, j));
      i = j;
    } else {
      result += input[i];
      i++;
    }
  }
  return result;
}
