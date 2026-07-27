#!/usr/bin/env node
/**
 * install-hooks.mjs — מתקין hook קל של pre-commit (פריט 11).
 * רק המהיר באמת (בדיקות + אימות תוכן, שניות בודדות) — השער המלא
 * (npm run check) נשאר החלטה מפורשת בסוף סבב, לא מס על כל commit.
 * עקיפה מודעת: git commit --no-verify.
 *
 * שימוש:  npm run hooks
 */
import { writeFileSync, chmodSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/env.mjs';

const hooksDir = join(ROOT, '.git/hooks');
if (!existsSync(hooksDir)) {
  console.error('✗ אין .git/hooks — לא ריפו?');
  process.exit(1);
}
const hook = `#!/bin/sh
# הותקן ע"י scripts/install-hooks.mjs — בדיקות מהירות בלבד (<10ש').
# עקיפה מודעת: git commit --no-verify
npm test --silent || exit 1
npm run --silent verify || exit 1
`;
const path = join(hooksDir, 'pre-commit');
writeFileSync(path, hook);
chmodSync(path, 0o755);
console.log('✓ hook הותקן: .git/hooks/pre-commit (בדיקות + אימות תוכן)');
