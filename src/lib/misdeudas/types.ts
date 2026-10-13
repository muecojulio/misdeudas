export type Person = {
  id: string;
  name: string;
  isMe: boolean;
  example: boolean;
};

export type Card = {
  id: string;
  personId: string;
  name: string;
  last4: string;
  example: boolean;
};

export type Share = {
  personId: string;
  percent: number;
};

export type Purchase = {
  id: string;
  description: string;
  operationDate: string;
  months: number;
  totalAmount: number;
  monthlyPayment: number;
  /** Null = the payment number follows the purchase date. */
  manualPayment: number | null;
  ownerId: string;
  cardId: string | null;
  shares: Share[];
  example: boolean;
};

/** A purchase or expense that I must pay to another person on a specific date. */
export type Payable = {
  id: string;
  personId: string;
  description: string;
  amount: number;
  dueDate: string;
  paid: boolean;
};

export type PayableInput = Pick<Payable, "personId" | "description" | "amount" | "dueDate">;

export type Holiday = {
  date: string;
  localName: string;
};

export type ThemeChoice = "system" | "light" | "dark";

export type TabId =
  "resumen" | "compras" | "pagos" | "personas" | "tarjetas" | "ajustes" | "privacidad" | "instalar";
