const fs = require('fs');

const file = 'I:/United-Motaheda/apps/shopper-native/app/(customer)/(account)/order/[id].tsx';
let c = fs.readFileSync(file, 'utf8');

if (!c.includes('import { supabase } from "@/lib/supabase"')) {
    c = c.replace(
        'import { useOrderDetail } from "@/features/orders/hooks/useOrders";', 
        'import { useOrderDetail } from "@/features/orders/hooks/useOrders";\nimport { supabase } from "@/lib/supabase";'
    );
}

// Add state for actions
c = c.replace(
    'const [isCancelling, setIsCancelling] = React.useState(false);',
    `const [actions, setActions] = React.useState<{ canCancel: boolean, canRequestReturn: boolean, cancellationMessage: string | null } | null>(null);
  React.useEffect(() => {
    if (id) {
      supabase.rpc("get_order_actions", { p_order_id: id }).then(({ data }) => setActions(data as any));
    }
  }, [id, order?.status]);
  
  const [isCancelling, setIsCancelling] = React.useState(false);`
);

// Replace hardcoded check
c = c.replace(
    '{["pending", "confirmed"].includes(order.status) && (',
    '{actions?.canCancel && ('
);

// Add idempotencyKey
c = c.replace(
    'await cancelOrder(id as string, "Customer requested cancellation");',
    'await cancelOrder(id as string, "Customer requested cancellation", `cancel-mobile-${id}-${Date.now()}`);'
);

fs.writeFileSync(file, c);
