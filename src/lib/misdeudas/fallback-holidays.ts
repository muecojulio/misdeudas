import type { Holiday } from "./types";

/** Official Mexico dates captured from Nager.Date, used only if the live call fails. */
export const FALLBACK_HOLIDAYS: Record<number, Holiday[]> = {
  2026: [
    { date: "2026-01-01", localName: "Año Nuevo" },
    { date: "2026-02-02", localName: "Día de la Constitución" },
    { date: "2026-03-16", localName: "Natalicio de Benito Juárez" },
    { date: "2026-04-02", localName: "Jueves Santo" },
    { date: "2026-04-03", localName: "Viernes Santo" },
    { date: "2026-05-01", localName: "Día del Trabajo" },
    { date: "2026-09-16", localName: "Día de la Independencia" },
    { date: "2026-11-16", localName: "Día de la Revolución" },
    { date: "2026-12-25", localName: "Navidad" },
  ],
  2027: [
    { date: "2027-01-01", localName: "Año Nuevo" },
    { date: "2027-02-01", localName: "Día de la Constitución" },
    { date: "2027-03-15", localName: "Natalicio de Benito Juárez" },
    { date: "2027-03-25", localName: "Jueves Santo" },
    { date: "2027-03-26", localName: "Viernes Santo" },
    { date: "2027-04-30", localName: "Día del Trabajo" },
    { date: "2027-09-16", localName: "Día de la Independencia" },
    { date: "2027-11-15", localName: "Día de la Revolución" },
    { date: "2027-12-25", localName: "Navidad" },
  ],
};
