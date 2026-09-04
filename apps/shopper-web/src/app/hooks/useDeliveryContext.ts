import { useMemo } from "react";
import { useLocationState } from "@pharmacy/domain-location";
import { useDeliveryQuote } from "./useDeliveryQuote";
import { useCart } from "../../contexts/CartContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { getLocalizedProductName } from "../localization";

export function useDeliveryContext() {
  const { cart } = useCart();
  const { lang } = useLanguage();
  const permission = useLocationState((state) => state.permission);
  const coordinates = useLocationState((state) => state.coordinates);

  const cartSnapshot = useMemo(
    () => ({
      items: cart.map((item) => ({
        productId: item.product_id,
        quantity: item.quantity,
        unitPrice: item.product?.price ?? 0,
        code: item.product?.code,
        name: item.product
          ? getLocalizedProductName(item.product, lang)
          : item.product_id,
      })),
      itemCount: cart.reduce((sum, i) => sum + i.quantity, 0),
      subtotal: cart.reduce(
        (sum, i) => sum + (i.product?.price ?? 0) * i.quantity,
        0,
      ),
    }),
    [cart, lang],
  );

  const quote = useDeliveryQuote(cartSnapshot);

  return {
    permission,
    coordinates,
    status:      quote.data ?? null,
    isLoading:   quote.isLoading,
    isAvailable: quote.data?.isDeliverable ?? null,
    fee:         quote.data?.cost ?? null,
    eta:         quote.data?.eta ?? null,
    branch:      quote.data?.branch ?? null,
    reasonCode:  quote.data?.reasonCode ?? null,
  };
}
