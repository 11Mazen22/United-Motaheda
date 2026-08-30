const fs = require('fs');

const file = 'I:/United-Motaheda/apps/shopper-native/app/(customer)/(account)/order/[id].tsx';
let c = fs.readFileSync(file, 'utf8');

c = c.replace(
    'const [actions, setActions] = React.useState<{ canCancel: boolean, canRequestReturn: boolean, cancellationMessage: string | null } | null>(null);',
    'const [actions, setActions] = React.useState<any>(null);'
);

c = c.replace(
    '{actions?.canCancel && (',
    '{actions?.cancel?.allowed && ('
);

c = c.replace(
    '{actions?.canRequestReturn && (',
    '{actions?.return?.allowed && ('
);

fs.writeFileSync(file, c);
