export type PaymentMethodType = "cod" | "instapay" | "vodafone";

export interface PaymentMethod {
  id: string;
  type: PaymentMethodType;
  labelKey: string;
  descKey: string;
  icon: string;
  is_active: boolean;
  detailsKey?: string;
  phone?: string;
}

export interface PaymentState {
  selected: PaymentMethodType;
  methods: PaymentMethod[];
  loading: boolean;
  setSelected: (type: PaymentMethodType) => void;
  reset: () => void;
}

export const PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: "cod",
    type: "cod",
    labelKey: "payment.methodCod",
    descKey: "payment.methodCodDesc",
    icon: "cash-outline",
    is_active: true,
    detailsKey: "payment.methodCodDetails",
  },
  {
    id: "instapay",
    type: "instapay",
    labelKey: "payment.methodInstapay",
    descKey: "payment.methodInstapayDesc",
    icon: "flash-outline",
    is_active: true,
    phone: "01124076520",
    detailsKey: "payment.methodInstapayDetails",
  },
  {
    id: "vodafone",
    type: "vodafone",
    labelKey: "payment.methodVodafone",
    descKey: "payment.methodVodafoneDesc",
    icon: "wallet-outline",
    is_active: true,
    phone: "01124076520",
    detailsKey: "payment.methodVodafoneDetails",
  },
];
