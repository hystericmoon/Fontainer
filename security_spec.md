# Fontainer Firestore Security Specification

## 1. Data Invariants
1. **Strict Tenant Isolation**: Every document under `/users/{userId}` and its subcollections (`libraries`, `fontLists`, `smartLists`, `fontMeta`, `adobeKits`) is readable and writable exclusively by the authenticated, email-verified user whose `request.auth.uid == userId`.
2. **Master Gate Enforcement**: No subcollection document (`libraries`, `fontLists`, `smartLists`, `fontMeta`, `adobeKits`) may be created, updated, or deleted unless the parent workspace document `/users/{userId}` exists.
3. **Immutable Ownership & Creation Timestamps**: `uid` / `ownerId` and `createdAt` can never be changed after document creation. All `createdAt` (on create) and `updatedAt` (on create/update) values must equal `request.time`.
4. **Strict Key & Size Boundaries**: Every string field enforces explicit `.size()` bounds; every array (`compareIds <= 12`, `fontIds <= 500`, `rules <= 20`, `tags <= 20`) enforces strict max size and element type checks; unknown ("shadow") fields are rejected via `hasOnly()`.
5. **ID Hardening**: Every single-document path ID (`userId`, `libraryId`, `listId`, `smartListId`, `fontId`, `kitId`) must match `^[a-zA-Z0-9_\-]+$` and be `<= 128` characters.
6. **Zero Blanket List Queries**: Every `allow list` verifies `isVerifiedOwner(userId)` AND `resource.data.ownerId == request.auth.uid` without `get()`/`exists()` calls.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Read/Write**: `auth = null` attempting `get` or `create` on `/users/alice` → `PERMISSION_DENIED`.
2. **Unverified Email Write**: `auth = { uid: 'alice', token: { email_verified: false } }` attempting `create` on `/users/alice` → `PERMISSION_DENIED`.
3. **Cross-Tenant Read (PII / Workspace Leak)**: `auth.uid = 'bob'` attempting `get` on `/users/alice` or `list` on `/users/alice/fontLists` → `PERMISSION_DENIED`.
4. **Identity Spoofing on Create**: `auth.uid = 'alice'` creating `/users/alice/fontLists/list-1` with `{ ownerId: 'bob', ... }` → `PERMISSION_DENIED`.
5. **Shadow Field Injection on Create**: `auth.uid = 'alice'` creating `/users/alice` with extra ghost field `{ isAdmin: true }` → `PERMISSION_DENIED`.
6. **Shadow Field Injection on Update**: `auth.uid = 'alice'` updating `/users/alice/fontLists/list-1` with `{ name: 'Valid', role: 'superadmin' }` → `PERMISSION_DENIED`.
7. **Immutable Field Tampering**: `auth.uid = 'alice'` updating `/users/alice/fontLists/list-1` to mutate `createdAt` or `ownerId` → `PERMISSION_DENIED`.
8. **Client-Forged Timestamp**: `auth.uid = 'alice'` creating `/users/alice/libraries/lib-1` with `createdAt` != `request.time` → `PERMISSION_DENIED`.
9. **ID Poisoning Attack**: `auth.uid = 'alice'` writing `/users/alice/fontLists/../../admin$bad` or a 200-char ID → `PERMISSION_DENIED`.
10. **Array Overflow / Denial of Wallet**: `auth.uid = 'alice'` writing `/users/alice/fontMeta/inter` with 25 tags (`> 20`) or 5000-char notes (`> 2000`) → `PERMISSION_DENIED`.
11. **Value Poisoning on Allowlisted Key**: `auth.uid = 'alice'` updating `/users/alice/adobeKits/abc123` setting `familyCount: "not-a-number"` or `name: 12345` → `PERMISSION_DENIED`.
12. **Orphaned Subcollection Write (Master Gate Bypass)**: `auth.uid = 'alice'` creating `/users/alice/libraries/lib-1` when `/users/alice` parent workspace document does not exist → `PERMISSION_DENIED`.
