import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { z } from "zod";
import { isISODate } from "./dates.ts";
import { cents, cleanText, equalPercents } from "./money.ts";
import type { Card, Payable, PayableInput, Person, Purchase, TabId, ThemeChoice } from "./types";

const ME = "p-me";

export type PurchaseInput = {
  description: string;
  operationDate: string;
  months: number;
  totalAmount: number;
  monthlyPayment: number;
  manualPayment: number | null;
  ownerId: string;
  cardId: string | null;
  shares: { personId: string; percent: number }[];
};

type LedgerState = {
  people: Person[];
  cards: Card[];
  purchases: Purchase[];
  payables: Payable[];
  theme: ThemeChoice;
  tab: TabId;
  cleared: boolean;
  hydrated: boolean;
  setHydrated: (value: boolean) => void;
  setTab: (tab: TabId) => void;
  setTheme: (theme: ThemeChoice) => void;
  addPerson: (name: string) => string | null;
  renamePerson: (id: string, name: string) => string | null;
  removePerson: (id: string) => string | null;
  addCard: (input: { personId: string; name: string; last4: string }) => string | null;
  updateCard: (
    id: string,
    input: { personId: string; name: string; last4: string },
  ) => string | null;
  removeCard: (id: string) => string | null;
  savePurchase: (input: PurchaseInput, id?: string) => string | null;
  removePurchase: (id: string) => void;
  savePayable: (input: PayableInput, id?: string) => string | null;
  removePayable: (id: string) => void;
  setPayablePaid: (id: string, paid: boolean) => void;
  setPaymentNumber: (id: string, paymentNumber: number) => void;
  loadExamples: () => void;
  removeExamples: () => void;
  clearAll: () => void;
  importBackup: (raw: string) => string | null;
};

function uid(prefix: string): string {
  const cryptoId = globalThis.crypto?.randomUUID?.();
  return cryptoId
    ? `${prefix}-${cryptoId}`
    : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function mePerson(): Person {
  return { id: ME, name: "Yo", isMe: true, example: false };
}

function exampleLedger(): Pick<LedgerState, "people" | "cards" | "purchases"> {
  const ana: Person = { id: "p-ana", name: "Ana López", isMe: false, example: true };
  const bbva: Card = { id: "c-bbva", personId: ME, name: "BBVA Oro", last4: "4521", example: true };
  const nu: Card = { id: "c-nu", personId: ana.id, name: "Nu", last4: "8830", example: true };
  const purchases: Purchase[] = [
    {
      id: "x-refri",
      description: "Refrigerador",
      operationDate: "2026-02-12",
      months: 12,
      totalAmount: 17400,
      monthlyPayment: 1450,
      manualPayment: null,
      ownerId: ME,
      cardId: bbva.id,
      shares: [
        { personId: ME, percent: 50 },
        { personId: ana.id, percent: 50 },
      ],
      example: true,
    },
    {
      id: "x-audio",
      description: "Audífonos",
      operationDate: "2026-08-03",
      months: 6,
      totalAmount: 2994,
      monthlyPayment: 499,
      manualPayment: null,
      ownerId: ana.id,
      cardId: nu.id,
      shares: [{ personId: ME, percent: 100 }],
      example: true,
    },
    {
      id: "x-pantalla",
      description: "Pantalla",
      operationDate: "2025-12-15",
      months: 10,
      totalAmount: 8990,
      monthlyPayment: 899,
      manualPayment: null,
      ownerId: ME,
      cardId: bbva.id,
      shares: [{ personId: ME, percent: 100 }],
      example: true,
    },
    {
      id: "x-bici",
      description: "Bicicleta",
      operationDate: "2026-01-25",
      months: 12,
      totalAmount: 9000,
      monthlyPayment: 750,
      manualPayment: 11,
      ownerId: ME,
      cardId: bbva.id,
      shares: [{ personId: ME, percent: 100 }],
      example: true,
    },
  ];
  return { people: [mePerson(), ana], cards: [bbva, nu], purchases };
}

function validateCardFields(
  name: string,
  last4: string,
  personId: string,
  people: Person[],
): string | null {
  if (!people.some((person) => person.id === personId)) return "Elige de quién es la tarjeta.";
  if (cleanText(name, 40).length < 2) return "Escribe el nombre de la tarjeta.";
  if (!/^\d{4}$/.test(last4)) return "La terminación son exactamente 4 números.";
  return null;
}

export function validatePurchase(
  input: PurchaseInput,
  people: Person[],
  cards: Card[],
): string | null {
  if (cleanText(input.description, 120).length < 2) return "Escribe qué compraste.";
  if (!isISODate(input.operationDate)) return "La fecha de la compra no es válida.";
  if (!Number.isInteger(input.months) || input.months < 1 || input.months > 48) {
    return "Los meses van de 1 a 48.";
  }
  if (
    !Number.isFinite(input.totalAmount) ||
    input.totalAmount <= 0 ||
    input.totalAmount > 100_000_000 ||
    cents(input.totalAmount) <= 0
  ) {
    return "Escribe un monto de compra válido.";
  }
  if (
    !Number.isFinite(input.monthlyPayment) ||
    input.monthlyPayment <= 0 ||
    input.monthlyPayment > 100_000_000 ||
    cents(input.monthlyPayment) <= 0
  ) {
    return "Escribe un pago mensual válido.";
  }
  if (!people.some((person) => person.id === input.ownerId)) return "Elige de quién es la compra.";
  if (input.cardId && !cards.some((card) => card.id === input.cardId))
    return "Esa tarjeta ya no está.";
  if (input.manualPayment != null) {
    if (
      !Number.isInteger(input.manualPayment) ||
      input.manualPayment < 0 ||
      input.manualPayment > input.months
    ) {
      return "El número de pago tiene que estar entre 0 y los meses.";
    }
  }
  if (input.shares.length === 0) return "Alguien tiene que pagar.";
  const ids = new Set<string>();
  for (const share of input.shares) {
    if (!people.some((person) => person.id === share.personId))
      return "Hay una persona que ya no existe.";
    if (ids.has(share.personId)) return "Una persona está repetida en el reparto.";
    ids.add(share.personId);
    if (!Number.isFinite(share.percent) || share.percent <= 0 || share.percent > 100) {
      return "Cada parte tiene que ser mayor que 0.";
    }
  }
  const sum = input.shares.reduce((total, share) => total + share.percent, 0);
  if (Math.abs(sum - 100) > 0.2) return "Las partes tienen que sumar 100%.";
  return null;
}

export function validatePayable(input: PayableInput, people: Person[]): string | null {
  if (!people.some((person) => person.id === input.personId && !person.isMe)) {
    return "Elige a la persona a quien le tienes que pagar.";
  }
  if (cleanText(input.description, 120).length < 2) return "Escribe qué tienes que pagar.";
  if (!isISODate(input.dueDate)) return "Escribe una fecha de pago válida.";
  if (
    !Number.isFinite(input.amount) ||
    input.amount <= 0 ||
    input.amount > 100_000_000 ||
    cents(input.amount) <= 0
  ) {
    return "Escribe un importe válido, mayor que cero.";
  }
  return null;
}

function normalizeShares(shares: { personId: string; percent: number }[]) {
  const total = shares.reduce((sum, share) => sum + share.percent, 0);
  if (total <= 0) return shares.map((share) => ({ ...share, percent: 0 }));
  const scaled = shares.map((share) => ({
    ...share,
    percent: cents((share.percent / total) * 100),
  }));
  const drift = cents(100 - scaled.reduce((sum, share) => sum + share.percent, 0));
  scaled[scaled.length - 1] = {
    ...scaled[scaled.length - 1]!,
    percent: cents(scaled[scaled.length - 1]!.percent + drift),
  };
  return scaled;
}

const personSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(60),
  isMe: z.boolean(),
  example: z.boolean().optional(),
});
const cardSchema = z.object({
  id: z.string().min(1).max(80),
  personId: z.string().min(1).max(80),
  name: z.string().min(1).max(40),
  last4: z.string().regex(/^\d{4}$/),
  example: z.boolean().optional(),
});
const purchaseSchema = z.object({
  id: z.string().min(1).max(80),
  description: z.string().min(1).max(120),
  operationDate: z.string(),
  months: z.number().int().min(1).max(48),
  totalAmount: z.number().min(0.01).max(100_000_000),
  monthlyPayment: z.number().min(0.01).max(100_000_000),
  manualPayment: z.number().int().min(0).max(48).nullable(),
  ownerId: z.string(),
  cardId: z.string().nullable(),
  shares: z
    .array(z.object({ personId: z.string(), percent: z.number().positive().max(100) }))
    .min(1)
    .max(20),
  example: z.boolean().optional(),
});
const payableSchema = z.object({
  id: z.string().min(1).max(80),
  personId: z.string().min(1).max(80),
  description: z.string().min(1).max(120),
  amount: z.number().min(0.01).max(100_000_000),
  dueDate: z.string(),
  paid: z.boolean().default(false),
});
const backupCollections = {
  people: z.array(personSchema).max(80),
  cards: z.array(cardSchema).max(80),
  purchases: z.array(purchaseSchema).max(400),
};
const backupSchema = z.discriminatedUnion("version", [
  z.object({
    version: z.literal(1),
    ...backupCollections,
    payables: z.array(payableSchema).max(400).optional(),
  }),
  z.object({
    version: z.literal(2),
    ...backupCollections,
    payables: z.array(payableSchema).max(400),
  }),
]);

type PersistedLedger = Pick<
  LedgerState,
  "people" | "cards" | "purchases" | "payables" | "theme" | "tab" | "cleared"
>;

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function sanitizePayables(value: unknown, people: Person[]): Payable[] {
  if (!Array.isArray(value)) return [];
  const parsed = value.slice(0, 400).flatMap((item) => {
    const result = payableSchema.safeParse(item);
    if (!result.success || validatePayable(result.data, people)) return [];
    return [
      {
        ...result.data,
        description: cleanText(result.data.description, 120),
        amount: cents(result.data.amount),
      },
    ];
  });
  return uniqueById(parsed);
}

/** Treat localStorage as untrusted JSON before restoring it into the UI store. */
export function sanitizePersistedState(value: unknown): PersistedLedger | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const cleared = raw.cleared === true;

  const parsedPeople = Array.isArray(raw.people)
    ? raw.people.slice(0, 80).flatMap((item) => {
        const parsed = personSchema.safeParse(item);
        if (!parsed.success) return [];
        const name = cleanText(parsed.data.name, 60);
        return name ? [{ ...parsed.data, name, example: Boolean(parsed.data.example) }] : [];
      })
    : [];
  const people = uniqueById(parsedPeople);
  if (people.length > 0) {
    const meIndex = Math.max(
      0,
      people.findIndex((person) => person.isMe || person.id === ME),
    );
    for (let index = 0; index < people.length; index += 1) {
      people[index] = { ...people[index]!, isMe: index === meIndex };
    }
  } else if (cleared) {
    people.push(mePerson());
  }
  const peopleIds = new Set(people.map((person) => person.id));

  const parsedCards = Array.isArray(raw.cards)
    ? raw.cards.slice(0, 80).flatMap((item) => {
        const parsed = cardSchema.safeParse(item);
        if (!parsed.success || !peopleIds.has(parsed.data.personId)) return [];
        const name = cleanText(parsed.data.name, 40);
        return name.length >= 2
          ? [{ ...parsed.data, name, example: Boolean(parsed.data.example) }]
          : [];
      })
    : [];
  const cards = uniqueById(parsedCards);
  const cardIds = new Set(cards.map((card) => card.id));

  const parsedPurchases = Array.isArray(raw.purchases)
    ? raw.purchases.slice(0, 400).flatMap((item) => {
        const parsed = purchaseSchema.safeParse(item);
        if (
          !parsed.success ||
          !isISODate(parsed.data.operationDate) ||
          !peopleIds.has(parsed.data.ownerId)
        ) {
          return [];
        }
        const description = cleanText(parsed.data.description, 120);
        const totalAmount = cents(parsed.data.totalAmount);
        const monthlyPayment = cents(parsed.data.monthlyPayment);
        if (description.length < 2 || totalAmount <= 0 || monthlyPayment <= 0) return [];

        const seenShareIds = new Set<string>();
        const shares = parsed.data.shares.filter((share) => {
          if (!peopleIds.has(share.personId) || seenShareIds.has(share.personId)) return false;
          seenShareIds.add(share.personId);
          return true;
        });
        const safeShares =
          shares.length > 0 ? shares : [{ personId: parsed.data.ownerId, percent: 100 }];
        return [
          {
            ...parsed.data,
            description,
            totalAmount,
            monthlyPayment,
            manualPayment:
              parsed.data.manualPayment == null
                ? null
                : Math.min(parsed.data.months, parsed.data.manualPayment),
            cardId:
              parsed.data.cardId && cardIds.has(parsed.data.cardId) ? parsed.data.cardId : null,
            shares: normalizeShares(safeShares),
            example: Boolean(parsed.data.example),
          },
        ];
      })
    : [];
  const purchases = uniqueById(parsedPurchases);

  const payables = sanitizePayables(raw.payables, people);

  const theme = z.enum(["system", "light", "dark"]).safeParse(raw.theme);
  const tab = z
    .enum([
      "resumen",
      "compras",
      "pagos",
      "personas",
      "tarjetas",
      "ajustes",
      "privacidad",
      "instalar",
    ])
    .safeParse(raw.tab);
  return {
    people,
    cards,
    purchases,
    payables,
    theme: theme.success ? theme.data : "system",
    tab: tab.success ? tab.data : "resumen",
    cleared,
  };
}

export function exportPayload(
  state: Pick<LedgerState, "people" | "cards" | "purchases" | "payables">,
) {
  return {
    version: 2 as const,
    people: state.people,
    cards: state.cards,
    purchases: state.purchases,
    payables: state.payables,
  };
}

function personUsed(id: string, cards: Card[], purchases: Purchase[], payables: Payable[]) {
  return (
    cards.some((card) => card.personId === id) ||
    purchases.some(
      (purchase) =>
        purchase.ownerId === id || purchase.shares.some((share) => share.personId === id),
    ) ||
    payables.some((payable) => payable.personId === id)
  );
}

export const useLedger = create<LedgerState>()(
  persist(
    (set, get) => ({
      people: [],
      cards: [],
      purchases: [],
      payables: [],
      theme: "system",
      tab: "resumen",
      cleared: false,
      hydrated: false,
      setHydrated: (value) => set({ hydrated: value }),
      setTab: (tab) => set({ tab }),
      setTheme: (theme) => set({ theme }),
      addPerson: (name) => {
        const clean = cleanText(name, 60);
        if (clean.length < 2) return "Escribe el nombre.";
        const person: Person = { id: uid("p"), name: clean, isMe: false, example: false };
        set({ people: [...get().people, person] });
        return null;
      },
      renamePerson: (id, name) => {
        const clean = cleanText(name, 60);
        if (clean.length < 2) return "El nombre es muy corto.";
        set({
          people: get().people.map((person) =>
            person.id === id ? { ...person, name: clean } : person,
          ),
        });
        return null;
      },
      removePerson: (id) => {
        const person = get().people.find((item) => item.id === id);
        if (!person) return "Esa persona ya no está.";
        if (person.isMe) return "Tu perfil se queda. Puedes cambiarte el nombre.";
        if (personUsed(id, get().cards, get().purchases, get().payables)) {
          return "Todavía aparece en una tarjeta, una compra o un pago.";
        }
        set({ people: get().people.filter((item) => item.id !== id) });
        return null;
      },
      addCard: (input) => {
        const error = validateCardFields(input.name, input.last4, input.personId, get().people);
        if (error) return error;
        const card: Card = {
          id: uid("c"),
          personId: input.personId,
          name: cleanText(input.name, 40),
          last4: input.last4,
          example: false,
        };
        set({ cards: [...get().cards, card] });
        return null;
      },
      updateCard: (id, input) => {
        const error = validateCardFields(input.name, input.last4, input.personId, get().people);
        if (error) return error;
        set({
          cards: get().cards.map((card) =>
            card.id === id
              ? {
                  ...card,
                  personId: input.personId,
                  name: cleanText(input.name, 40),
                  last4: input.last4,
                  example: false,
                }
              : card,
          ),
        });
        return null;
      },
      removeCard: (id) => {
        if (get().purchases.some((purchase) => purchase.cardId === id)) {
          return "Esta tarjeta está en una compra. Cámbiala ahí antes de borrarla.";
        }
        set({ cards: get().cards.filter((card) => card.id !== id) });
        return null;
      },
      savePurchase: (input, id) => {
        const error = validatePurchase(input, get().people, get().cards);
        if (error) return error;
        const purchase: Purchase = {
          id: id ?? uid("x"),
          description: cleanText(input.description, 120),
          operationDate: input.operationDate,
          months: input.months,
          totalAmount: cents(input.totalAmount),
          monthlyPayment: cents(input.monthlyPayment),
          manualPayment: input.manualPayment,
          ownerId: input.ownerId,
          cardId: input.cardId,
          shares: normalizeShares(input.shares),
          example: false,
        };
        const existing = get().purchases.some((item) => item.id === purchase.id);
        set({
          purchases: existing
            ? get().purchases.map((item) => (item.id === purchase.id ? purchase : item))
            : [purchase, ...get().purchases],
        });
        return null;
      },
      removePurchase: (id) => set({ purchases: get().purchases.filter((item) => item.id !== id) }),
      savePayable: (input, id) => {
        const error = validatePayable(input, get().people);
        if (error) return error;
        const existing = id ? get().payables.find((payable) => payable.id === id) : undefined;
        if (id && !existing) return "Ese pago ya no está.";
        if (!existing && get().payables.length >= 400) return "Tu libreta admite hasta 400 pagos.";
        const payable: Payable = {
          id: id ?? uid("pay"),
          personId: input.personId,
          description: cleanText(input.description, 120),
          amount: cents(input.amount),
          dueDate: input.dueDate,
          paid: existing?.paid ?? false,
        };
        set({
          payables: existing
            ? get().payables.map((item) => (item.id === payable.id ? payable : item))
            : [payable, ...get().payables],
        });
        return null;
      },
      removePayable: (id) => set({ payables: get().payables.filter((item) => item.id !== id) }),
      setPayablePaid: (id, paid) =>
        set({
          payables: get().payables.map((item) => (item.id === id ? { ...item, paid } : item)),
        }),
      setPaymentNumber: (id, paymentNumber) => {
        set({
          purchases: get().purchases.map((purchase) => {
            if (purchase.id !== id) return purchase;
            const next = Math.max(0, Math.min(purchase.months, Math.round(paymentNumber)));
            return { ...purchase, manualPayment: next };
          }),
        });
      },
      loadExamples: () => {
        const sample = exampleLedger();
        const people = [...get().people];
        for (const person of sample.people) {
          if (!people.some((item) => item.id === person.id)) people.push(person);
        }
        if (!people.some((person) => person.isMe)) people.unshift(mePerson());
        const cards = [...get().cards];
        for (const card of sample.cards) {
          if (!cards.some((item) => item.id === card.id)) cards.push(card);
        }
        const purchases = [...get().purchases];
        for (const purchase of sample.purchases) {
          if (!purchases.some((item) => item.id === purchase.id)) purchases.push(purchase);
        }
        set({ people, cards, purchases, cleared: false });
      },
      removeExamples: () => {
        const purchases = get().purchases.filter((purchase) => !purchase.example);
        const cards = get().cards.filter(
          (card) => !card.example || purchases.some((purchase) => purchase.cardId === card.id),
        );
        const people = get().people.filter(
          (person) =>
            person.isMe ||
            !person.example ||
            personUsed(person.id, cards, purchases, get().payables),
        );
        set({ people, cards, purchases });
      },
      clearAll: () =>
        set({ people: [mePerson()], cards: [], purchases: [], payables: [], cleared: true }),
      importBackup: (raw) => {
        if (raw.length > 1_000_000) return "El archivo es demasiado grande.";
        let json: unknown;
        try {
          json = JSON.parse(raw);
        } catch {
          return "Ese archivo no se puede leer.";
        }
        const parsed = backupSchema.safeParse(json);
        if (!parsed.success) return "El respaldo no tiene el formato de Mis deudas.";
        const hasDuplicateIds = (items: { id: string }[]) =>
          new Set(items.map((item) => item.id)).size !== items.length;
        if (
          hasDuplicateIds(parsed.data.people) ||
          hasDuplicateIds(parsed.data.cards) ||
          hasDuplicateIds(parsed.data.purchases) ||
          hasDuplicateIds(parsed.data.payables ?? [])
        ) {
          return "El respaldo contiene identificadores repetidos.";
        }
        const peopleIn = parsed.data.people.map((person) => ({
          ...person,
          name: cleanText(person.name, 60),
          example: Boolean(person.example),
        }));
        if (peopleIn.length === 0) return "El respaldo no trae personas.";
        let meSeen = false;
        const people = peopleIn.map((person) => {
          const isMe = person.isMe && !meSeen;
          if (isMe) meSeen = true;
          return { ...person, isMe };
        });
        if (!meSeen) people[0] = { ...people[0]!, isMe: true };
        const peopleIds = new Set(people.map((person) => person.id));
        const cards = parsed.data.cards
          .filter((card) => peopleIds.has(card.personId))
          .map((card) => ({
            ...card,
            name: cleanText(card.name, 40),
            example: Boolean(card.example),
          }));
        const cardIds = new Set(cards.map((card) => card.id));
        const me = people.find((person) => person.isMe)!;
        const purchases = parsed.data.purchases.flatMap((purchase) => {
          if (!isISODate(purchase.operationDate) || !peopleIds.has(purchase.ownerId)) return [];
          const seenShareIds = new Set<string>();
          const shares = purchase.shares.filter((share) => {
            if (!peopleIds.has(share.personId) || seenShareIds.has(share.personId)) return false;
            seenShareIds.add(share.personId);
            return true;
          });
          const safeShares = shares.length > 0 ? shares : [{ personId: me.id, percent: 100 }];
          return [
            {
              ...purchase,
              description: cleanText(purchase.description, 120),
              totalAmount: cents(purchase.totalAmount),
              monthlyPayment: cents(purchase.monthlyPayment),
              manualPayment:
                purchase.manualPayment == null
                  ? null
                  : Math.min(purchase.months, purchase.manualPayment),
              cardId: purchase.cardId && cardIds.has(purchase.cardId) ? purchase.cardId : null,
              shares: normalizeShares(safeShares),
              example: Boolean(purchase.example),
            } satisfies Purchase,
          ];
        });
        const payables = sanitizePayables(parsed.data.payables, people);
        if (payables.length !== (parsed.data.payables?.length ?? 0)) {
          return "El respaldo contiene pagos con una persona, fecha o importe no válido.";
        }
        set({ people, cards, purchases, payables, cleared: false });
        return null;
      },
    }),
    {
      name: "misdeudas-ledger-v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({
        people: state.people,
        cards: state.cards,
        purchases: state.purchases,
        payables: state.payables,
        theme: state.theme,
        tab: state.tab,
        cleared: state.cleared,
      }),
      merge: (persistedState, currentState) => {
        const restored = sanitizePersistedState(persistedState);
        return restored ? { ...currentState, ...restored } : currentState;
      },
    },
  ),
);

export { equalPercents, ME };
