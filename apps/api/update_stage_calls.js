const fs = require('fs');

function replaceFile(path, replacer) {
  let content = fs.readFileSync(path, 'utf8');
  content = replacer(content);
  fs.writeFileSync(path, content);
}

const basePath = 'I:/United-Motaheda/apps/shopper-native/src/features/driver/';

replaceFile(basePath + 'components/OrderCardNew.tsx', (c) => {
  return c
    .replace('getStageAction(stage)', 'getStageAction(stage, assignment?.assignmentKind)')
    .replace('getStageStatusLabel(stage)', 'getStageStatusLabel(stage, assignment?.assignmentKind)');
});

replaceFile(basePath + 'screens/DeliveryExecutionScreen.tsx', (c) => {
  return c
    .replace('getStageAction(stage)', 'getStageAction(stage, assignment?.assignmentKind)')
    .replace('getStageStatusLabel(stage)', 'getStageStatusLabel(stage, assignment?.assignmentKind)');
});

replaceFile(basePath + 'screens/DriverManifest.tsx', (c) => {
  // Wait, in DriverManifest, `assignment` is derived as `assignmentMap[item.id]`.
  // Let's see how it gets assignment.
  // Actually, I can just replace `getStageAction(stage)` with `getStageAction(stage, assignment?.assignmentKind)` 
  // because typically the code looks like: `const assignment = ...`
  return c
    .replace('getStageAction(stage)', 'getStageAction(stage, assignment?.assignmentKind)')
    .replace('getStageStatusLabel(stage)', 'getStageStatusLabel(stage, assignment?.assignmentKind)');
});
