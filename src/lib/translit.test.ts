import { describe, expect, it } from "vitest";
import { latinToCyrillic } from "./translit";

describe("latinToCyrillic", () => {
  it("transliterates plain words", () => {
    expect(latinToCyrillic("mashina")).toBe("машина");
    expect(latinToCyrillic("mashinalar")).toBe("машиналар");
    expect(latinToCyrillic("xodimlar")).toBe("ходимлар");
    expect(latinToCyrillic("haydovchi")).toBe("ҳайдовчи");
    expect(latinToCyrillic("hisobot")).toBe("ҳисобот");
    expect(latinToCyrillic("punkt")).toBe("пункт");
    expect(latinToCyrillic("smena")).toBe("смена");
    expect(latinToCyrillic("obed")).toBe("обед");
    expect(latinToCyrillic("rasxodlar")).toBe("расходлар");
    expect(latinToCyrillic("jarimalar")).toBe("жарималар");
  });

  it("handles the o'/g' apostrophe letters, with different apostrophe characters", () => {
    expect(latinToCyrillic("qo'shish")).toBe("қўшиш");
    expect(latinToCyrillic("qoʻshish")).toBe("қўшиш");
    expect(latinToCyrillic("o'chirish")).toBe("ўчириш");
    expect(latinToCyrillic("bog'")).toBe("боғ");
    expect(latinToCyrillic("yog'och")).toBe("ёғоч");
  });

  it("handles sh, ch, ng digraphs", () => {
    expect(latinToCyrillic("Chiqish")).toBe("Чиқиш");
    expect(latinToCyrillic("Kirim-chiqim")).toBe("Кирим-чиқим");
    expect(latinToCyrillic("tasdiqlash")).toBe("тасдиқлаш");
  });

  it("handles y as a glide before a vowel (ya/yu/yo/ye)", () => {
    expect(latinToCyrillic("yoqilg'i")).toBe("ёқилғи");
    expect(latinToCyrillic("yangi")).toBe("янги");
    expect(latinToCyrillic("yuk")).toBe("юк");
  });

  it("does not treat y + o as the yo digraph when the o starts an o' unit", () => {
    expect(latinToCyrillic("yo'l")).toBe("йўл");
    expect(latinToCyrillic("Yo'lovchilar")).toBe("Йўловчилар");
  });

  it("does not treat n + g as the ng digraph when the g starts a g' unit", () => {
    expect(latinToCyrillic("Boshlang'ich")).toBe("Бошланғич");
    expect(latinToCyrillic("tanga")).toBe("танга");
  });

  it("handles y as a plain consonant after a vowel", () => {
    expect(latinToCyrillic("reys")).toBe("рейс");
    expect(latinToCyrillic("moy")).toBe("мой");
  });

  it("handles e vs э (word-initial and after a vowel become э)", () => {
    expect(latinToCyrillic("Egasi")).toBe("Эгаси");
    expect(latinToCyrillic("test")).toBe("тест");
    expect(latinToCyrillic("Farg'ona")).toBe("Фарғона");
  });

  it("preserves capitalization of the first letter", () => {
    expect(latinToCyrillic("Xodimlar")).toBe("Ходимлар");
    expect(latinToCyrillic("Mashinalar")).toBe("Машиналар");
    expect(latinToCyrillic("Saqlash")).toBe("Сақлаш");
  });

  it("leaves digits and punctuation around words untouched", () => {
    expect(latinToCyrillic("1-avgust")).toBe("1-август");
  });

  it("passes through numbers and separators unchanged around words", () => {
    expect(latinToCyrillic("150 000 so'm")).toBe("150 000 сўм");
    expect(latinToCyrillic("Farg'ona-Quva")).toBe("Фарғона-Қува");
  });

  it("maps a bare apostrophe (not part of o'/g') to the tutuq belgisi ъ", () => {
    expect(latinToCyrillic("ma'lumot")).toBe("маълумот");
  });

  it("handles a full sentence", () => {
    expect(latinToCyrillic("Bugun yig'ildi")).toBe("Бугун йиғилди");
    expect(latinToCyrillic("Qabul qilingan mashina")).toBe("Қабул қилинган машина");
  });
});
