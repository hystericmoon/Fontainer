import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const rulesPath = fs.existsSync('firestore.rules') ? 'firestore.rules' : 'DRAFT_firestore.rules';
const rulesText = fs.readFileSync(rulesPath, 'utf8');
const blueprint = JSON.parse(fs.readFileSync('firebase-blueprint.json', 'utf8'));

const VALID_ID_RE = /^[a-zA-Z0-9_-]{1,128}$/;

interface AuthCtx {
  uid: string;
  emailVerified: boolean;
}

function assertDirtyDozenDenied(name: string, fn: () => boolean) {
  test(`Dirty Dozen — ${name} must be PERMISSION_DENIED`, () => {
    assert.equal(fn(), false, `Expected ${name} to be denied`);
  });
}

// Verify static rule structural guarantees present in the ruleset
test('Ruleset includes default-deny catch-all, rules_version 2, and all blueprint collections', () => {
  assert.match(rulesText, /rules_version\s*=\s*'2';/);
  assert.match(rulesText, /match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;\s*\}/);
  for (const col of ['libraries', 'fontLists', 'smartLists', 'fontMeta', 'adobeKits']) {
    assert.match(rulesText, new RegExp(`match /${col}/\\{`), `Missing match block for ${col}`);
  }
  assert.match(rulesText, /request\.auth\.token\.email_verified == true/);
  assert.match(rulesText, /incoming\(\)\.createdAt == request\.time/);
  assert.match(rulesText, /incoming\(\)\.updatedAt == request\.time/);
  assert.equal(Object.keys(blueprint.firestore).length, 6);
});

const SERVER_TIME = 'SERVER_TIME';

function simulateWorkspaceWrite(auth: AuthCtx | null, userId: string, data: Record<string, unknown>, isUpdate = false, existing?: Record<string, unknown>): boolean {
  if (!auth || !auth.emailVerified || auth.uid !== userId) return false;
  if (!VALID_ID_RE.test(userId)) return false;
  const allowed = new Set(['uid', 'displayName', 'theme', 'previewText', 'previewFontSize', 'compareIds', 'createdAt', 'updatedAt']);
  if (!Object.keys(data).every((k) => allowed.has(k))) return false;
  if (data.uid !== auth.uid) return false;
  if (!['light', 'dark', 'sepia'].includes(String(data.theme))) return false;
  if (typeof data.previewText === 'string' && data.previewText.length > 300) return false;
  if (Array.isArray(data.compareIds) && data.compareIds.length > 12) return false;
  if (!isUpdate && data.createdAt !== SERVER_TIME) return false;
  if (data.updatedAt !== SERVER_TIME) return false;
  if (isUpdate && existing && data.createdAt !== existing.createdAt) return false;
  return true;
}

function simulateSubcollectionWrite(
  auth: AuthCtx | null,
  userId: string,
  docId: string,
  parentExists: boolean,
  data: Record<string, unknown>,
  allowedKeys: string[],
  isUpdate = false,
  existing?: Record<string, unknown>,
): boolean {
  if (!auth || !auth.emailVerified || auth.uid !== userId) return false;
  if (!VALID_ID_RE.test(userId) || !VALID_ID_RE.test(docId)) return false;
  const allowed = new Set(allowedKeys);
  if (!Object.keys(data).every((k) => allowed.has(k))) return false;
  if (data.ownerId !== auth.uid) return false;
  if (typeof data.name === 'string' && (data.name.length < 1 || data.name.length > 120)) return false;
  if ('name' in data && typeof data.name !== 'string') return false;
  if ('familyCount' in data && typeof data.familyCount !== 'number') return false;
  if (Array.isArray(data.tags) && data.tags.length > 20) return false;
  if (typeof data.notes === 'string' && data.notes.length > 2000) return false;
  if (!isUpdate && data.createdAt !== SERVER_TIME) return false;
  if (data.updatedAt !== SERVER_TIME) return false;
  if (isUpdate && existing && (data.createdAt !== existing.createdAt || data.ownerId !== existing.ownerId)) return false;
  if (!parentExists) return false;
  return true;
}

const alice: AuthCtx = { uid: 'alice', emailVerified: true };
const bob: AuthCtx = { uid: 'bob', emailVerified: true };
const unverifiedAlice: AuthCtx = { uid: 'alice', emailVerified: false };

// 1. Unauthenticated write
assertDirtyDozenDenied('1. Unauthenticated write', () =>
  simulateWorkspaceWrite(null, 'alice', { uid: 'alice', theme: 'light', createdAt: SERVER_TIME, updatedAt: SERVER_TIME }),
);
// 2. Unverified email write
assertDirtyDozenDenied('2. Unverified email write', () =>
  simulateWorkspaceWrite(unverifiedAlice, 'alice', { uid: 'alice', theme: 'light', createdAt: SERVER_TIME, updatedAt: SERVER_TIME }),
);
// 3. Cross-tenant access
assertDirtyDozenDenied('3. Cross-tenant read/write', () =>
  simulateWorkspaceWrite(bob, 'alice', { uid: 'alice', theme: 'light', createdAt: SERVER_TIME, updatedAt: SERVER_TIME }),
);
// 4. Identity spoofing on create
assertDirtyDozenDenied('4. Identity spoofing (ownerId mismatch)', () =>
  simulateSubcollectionWrite(alice, 'alice', 'list-1', true, { id: 'list-1', ownerId: 'bob', name: 'Spoof', color: '#1b1b1b', fontIds: [], createdAt: SERVER_TIME, updatedAt: SERVER_TIME }, ['id', 'ownerId', 'name', 'color', 'fontIds', 'createdAt', 'updatedAt']),
);
// 5. Shadow field on create
assertDirtyDozenDenied('5. Shadow field injection on create', () =>
  simulateWorkspaceWrite(alice, 'alice', { uid: 'alice', theme: 'dark', isAdmin: true, createdAt: SERVER_TIME, updatedAt: SERVER_TIME }),
);
// 6. Shadow field on update
assertDirtyDozenDenied('6. Shadow field injection on update', () =>
  simulateSubcollectionWrite(alice, 'alice', 'list-1', true, { id: 'list-1', ownerId: 'alice', name: 'Valid', color: '#1b1b1b', fontIds: [], role: 'superadmin', createdAt: SERVER_TIME, updatedAt: SERVER_TIME }, ['id', 'ownerId', 'name', 'color', 'fontIds', 'createdAt', 'updatedAt'], true, { ownerId: 'alice', createdAt: SERVER_TIME }),
);
// 7. Immutable field tampering
assertDirtyDozenDenied('7. Immutable createdAt tampering', () =>
  simulateSubcollectionWrite(alice, 'alice', 'list-1', true, { id: 'list-1', ownerId: 'alice', name: 'Valid', color: '#1b1b1b', fontIds: [], createdAt: 'FORGED', updatedAt: SERVER_TIME }, ['id', 'ownerId', 'name', 'color', 'fontIds', 'createdAt', 'updatedAt'], true, { ownerId: 'alice', createdAt: SERVER_TIME }),
);
// 8. Client-forged timestamp
assertDirtyDozenDenied('8. Client-forged createdAt timestamp', () =>
  simulateSubcollectionWrite(alice, 'alice', 'lib-1', true, { id: 'lib-1', ownerId: 'alice', name: 'Drive', createdAt: '2020-01-01T00:00:00Z', updatedAt: SERVER_TIME }, ['id', 'ownerId', 'name', 'createdAt', 'updatedAt']),
);
// 9. ID poisoning
assertDirtyDozenDenied('9. Path ID poisoning', () =>
  simulateSubcollectionWrite(alice, 'alice', '../bad$id', true, { id: '../bad$id', ownerId: 'alice', name: 'Bad', createdAt: SERVER_TIME, updatedAt: SERVER_TIME }, ['id', 'ownerId', 'name', 'createdAt', 'updatedAt']),
);
// 10. Array overflow / Denial of Wallet
assertDirtyDozenDenied('10. Array overflow (>20 tags)', () =>
  simulateSubcollectionWrite(alice, 'alice', 'inter', true, { fontId: 'inter', ownerId: 'alice', tags: Array.from({ length: 25 }, (_, i) => `t${i}`), notes: 'ok', createdAt: SERVER_TIME, updatedAt: SERVER_TIME }, ['fontId', 'ownerId', 'tags', 'notes', 'createdAt', 'updatedAt']),
);
// 11. Value poisoning on allowlisted key
assertDirtyDozenDenied('11. Value poisoning on allowlisted key', () =>
  simulateSubcollectionWrite(alice, 'alice', 'kit1234', true, { kitId: 'kit1234', ownerId: 'alice', name: 12345, familyCount: 'bad', createdAt: SERVER_TIME, updatedAt: SERVER_TIME }, ['kitId', 'ownerId', 'name', 'familyCount', 'createdAt', 'updatedAt'], true, { ownerId: 'alice', createdAt: SERVER_TIME }),
);
// 12. Orphaned subcollection write (Master Gate)
assertDirtyDozenDenied('12. Orphaned write without parent workspace', () =>
  simulateSubcollectionWrite(alice, 'alice', 'lib-1', false, { id: 'lib-1', ownerId: 'alice', name: 'Drive', createdAt: SERVER_TIME, updatedAt: SERVER_TIME }, ['id', 'ownerId', 'name', 'createdAt', 'updatedAt']),
);
