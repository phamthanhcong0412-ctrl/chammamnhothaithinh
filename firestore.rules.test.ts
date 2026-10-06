/**
 * Phase 0 Security Test Specification for Firestore Rules ("Dirty Dozen" Payloads)
 */
export interface DirtyDozenTestCase {
  id: number;
  name: string;
  collection: string;
  docId: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  auth: { uid: string; email?: string; email_verified?: boolean } | null;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_PAYLOADS: DirtyDozenTestCase[] = [
  {
    id: 1,
    name: 'Unauthenticated Write',
    collection: 'users',
    docId: 'user_1',
    operation: 'create',
    auth: null,
    payload: { id: 'user_1', ownerId: 'user_1', username: 'nv_1', role: 'staff' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified Email Spoof',
    collection: 'users',
    docId: 'user_1',
    operation: 'create',
    auth: { uid: 'user_1', email: 'buihoai0412@gmail.com', email_verified: false },
    payload: { id: 'user_1', ownerId: 'user_1', username: 'ptcong', role: 'admin' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Self-Assigned Admin Role',
    collection: 'users',
    docId: 'user_2',
    operation: 'create',
    auth: { uid: 'user_2', email: 'staff@example.com', email_verified: true },
    payload: { id: 'user_2', ownerId: 'user_2', username: 'nv_2', role: 'admin' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Identity Spoofing on Create',
    collection: 'users',
    docId: 'user_2',
    operation: 'create',
    auth: { uid: 'user_2', email: 'staff@example.com', email_verified: true },
    payload: { id: 'user_2', ownerId: 'user_1', username: 'nv_2', role: 'staff' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Shadow Field Injection',
    collection: 'users',
    docId: 'user_2',
    operation: 'create',
    auth: { uid: 'user_2', email: 'staff@example.com', email_verified: true },
    payload: { id: 'user_2', ownerId: 'user_2', username: 'nv_2', role: 'staff', isSuperAdmin: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'PII Leak via Unauthorized Get',
    collection: 'users',
    docId: 'user_1',
    operation: 'get',
    auth: { uid: 'user_2', email: 'staff@example.com', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Blanket List Scraping',
    collection: 'users',
    docId: '*',
    operation: 'list',
    auth: { uid: 'user_2', email: 'staff@example.com', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Role Escalation on Update',
    collection: 'users',
    docId: 'user_2',
    operation: 'update',
    auth: { uid: 'user_2', email: 'staff@example.com', email_verified: true },
    payload: { role: 'admin', hourlyRate: 999999 },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Immutable Field Mutation',
    collection: 'users',
    docId: 'user_2',
    operation: 'update',
    auth: { uid: 'user_2', email: 'staff@example.com', email_verified: true },
    payload: { ownerId: 'user_admin_1' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Forged Client Timestamp',
    collection: 'attendance',
    docId: 'att_1',
    operation: 'create',
    auth: { uid: 'user_2', email: 'staff@example.com', email_verified: true },
    payload: { id: 'att_1', ownerId: 'user_2', userId: 'user_2', createdAt: '1999-01-01T00:00:00Z' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Terminal State Re-opening',
    collection: 'attendance',
    docId: 'att_1',
    operation: 'update',
    auth: { uid: 'user_2', email: 'staff@example.com', email_verified: true },
    payload: { status: 'working', totalMinutes: 999 },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Resource Poisoning / Oversized String',
    collection: 'users',
    docId: 'user_2',
    operation: 'update',
    auth: { uid: 'user_2', email: 'staff@example.com', email_verified: true },
    payload: { name: 'A'.repeat(5000) },
    expectedResult: 'PERMISSION_DENIED',
  },
];
