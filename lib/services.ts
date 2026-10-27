// Placeholder catalogue until TPS confirms the real services and prices.

export type Treatment = {
  id: string;
  kind: "treatment";
  name: string;
  pricePence: number;
};

export type Programme = {
  id: string;
  kind: "programme";
  name: string;
};

export type Service = Treatment | Programme;

export const SERVICES: readonly Service[] = [
  {
    id: "postnatal-massage",
    kind: "treatment",
    name: "Postnatal Massage",
    pricePence: 9000,
  },
  {
    id: "pelvic-health-consultation",
    kind: "treatment",
    name: "Pelvic Health Consultation",
    pricePence: 12000,
  },
  {
    id: "lactation-consultation",
    kind: "treatment",
    name: "Lactation Consultation",
    pricePence: 8500,
  },
  { id: "programme-7-day", kind: "programme", name: "7-Day Postpartum Programme" },
  {
    id: "programme-14-day",
    kind: "programme",
    name: "14-Day Postpartum Programme",
  },
  {
    id: "programme-30-day",
    kind: "programme",
    name: "30-Day Postpartum Programme",
  },
];

export function getServiceById(id: string): Service | null {
  return SERVICES.find((service) => service.id === id) ?? null;
}

/** Credit a treatment can use now, and what the mum settles with TPS herself. */
export function calculateCreditRequest(
  treatment: Treatment,
  availableCreditPence: number,
): { creditPence: number; shortfallPence: number } {
  const creditPence = Math.max(
    0,
    Math.min(treatment.pricePence, availableCreditPence),
  );
  return { creditPence, shortfallPence: treatment.pricePence - creditPence };
}
