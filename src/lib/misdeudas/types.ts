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

export type Holiday = {
  date: string;
  localName: string;
};

export type ThemeChoice = "system" | "light" | "dark";

export type TabId =
  | "resumen"
  | "compras"
  | "personas"
  | "tarjetas"
  | "ajustes"
  | "privacidad"
  | "instalar";
