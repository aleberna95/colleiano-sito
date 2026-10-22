import { describe, expect, it } from "vitest";
import { testoQrWifi } from "@/lib/mappa";
import { adessoEDopo, momentoDaInput, orariDaInput, perGiorno, statoEvento } from "@/lib/programma";

const ore = (h: number, m = 0) => momentoDaInput("2027-07-17", `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`).getTime();

const messa = { id: "messa", inizio: ore(11), fine: ore(12) };
const pranzo = { id: "pranzo", inizio: ore(13) };
const giochi = { id: "giochi", inizio: ore(16) };
const ballo = { id: "ballo", inizio: ore(21) };
const cena = { id: "cena", inizio: ore(21) };
const eventi = [messa, pranzo, giochi, ballo, cena];

describe("programma nel tempo", () => {
  it("le ore si leggono in Italia (luglio = UTC+2)", () => {
    expect(new Date(ore(11)).toISOString()).toBe("2027-07-17T09:00:00.000Z");
  });

  it("un evento con la fine è in corso fino alla fine", () => {
    expect(statoEvento(messa, eventi, ore(10, 59))).toBe("futuro");
    expect(statoEvento(messa, eventi, ore(11, 30))).toBe("in_corso");
    expect(statoEvento(messa, eventi, ore(12))).toBe("finito");
  });

  it("senza fine dura fino al successivo, al massimo due ore", () => {
    expect(statoEvento(pranzo, eventi, ore(14, 59))).toBe("in_corso");
    expect(statoEvento(pranzo, eventi, ore(15))).toBe("finito");
    expect(statoEvento(ballo, eventi, ore(22, 59))).toBe("in_corso");
    expect(statoEvento(ballo, eventi, ore(23))).toBe("finito");
  });

  it("adesso e dopo", () => {
    expect(adessoEDopo(eventi, ore(9))).toEqual({ adesso: [], dopo: [messa] });
    expect(adessoEDopo(eventi, ore(11, 30))).toEqual({ adesso: [messa], dopo: [pranzo] });
    expect(adessoEDopo(eventi, ore(17))).toEqual({ adesso: [giochi], dopo: [ballo, cena] });
    expect(adessoEDopo(eventi, ore(22))).toEqual({ adesso: [ballo, cena], dopo: [] });
    expect(adessoEDopo([], ore(22))).toEqual({ adesso: [], dopo: [] });
  });

  it("divide per giorno italiano", () => {
    const notte = { inizio: momentoDaInput("2027-07-18", "00:30").getTime() };
    expect(perGiorno([messa, ballo, notte]).map((g) => [g.giorno, g.eventi.length])).toEqual([
      ["2027-07-17", 2],
      ["2027-07-18", 1],
    ]);
  });

  it("una fine prima dell'inizio è dopo mezzanotte", () => {
    const { inizio, fine } = orariDaInput("2027-07-17", "22:00", "02:00");
    expect(inizio.toISOString()).toBe("2027-07-17T20:00:00.000Z");
    expect(fine?.toISOString()).toBe("2027-07-18T00:00:00.000Z");
    expect(orariDaInput("2027-07-17", "22:00", "").fine).toBeUndefined();
  });
});

describe("QR del Wi-Fi", () => {
  it("rete con e senza password, caratteri speciali protetti", () => {
    expect(testoQrWifi({ nomeRete: "colleiano-wifi" })).toBe("WIFI:T:nopass;S:colleiano-wifi;;");
    expect(testoQrWifi({ nomeRete: "a;b", password: "x:y,z\"" })).toBe('WIFI:T:WPA;S:a\\;b;P:x\\:y\\,z\\";;');
  });
});
