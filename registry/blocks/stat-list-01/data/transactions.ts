import {
  ArrowDownLeft,
  Banknote,
  CreditCard,
  RotateCcw,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface Transaction {
  icon: LucideIcon;
  title: string;
  sub: string;
  amount: string;
  positive: boolean;
}

export const TRANSACTIONS: Transaction[] = [
  {
    icon: Banknote,
    title: "PayPal transfer",
    sub: "Money added",
    amount: "+$6,235",
    positive: true,
  },
  { icon: Wallet, title: "Wallet", sub: "Big brands", amount: "+$345", positive: true },
  {
    icon: CreditCard,
    title: "Credit card",
    sub: "Money reversed",
    amount: "+$2,235",
    positive: true,
  },
  {
    icon: ArrowDownLeft,
    title: "Bank transfer",
    sub: "Money added",
    amount: "+$320",
    positive: true,
  },
  { icon: RotateCcw, title: "Refund", sub: "Bill payment", amount: "-$32", positive: false },
];
