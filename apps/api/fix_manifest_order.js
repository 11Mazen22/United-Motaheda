const fs = require('fs');
const file = 'I:/United-Motaheda/apps/shopper-native/src/features/driver/api.ts';
let c = fs.readFileSync(file, 'utf8');

if (!c.includes('assignmentKind?:    string;')) {
    c = c.replace(
        'assignmentId:       string;',
        'assignmentId:       string;\n  assignmentKind?:    string;'
    );
    c = c.replace(
        'assignmentId: assignment.id,',
        'assignmentId: assignment.id,\n    assignmentKind: assignment.assignmentKind,'
    );
    fs.writeFileSync(file, c);
}
