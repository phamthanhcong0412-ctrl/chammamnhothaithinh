# Security Specification (Phase 0: Payload-First Security TDD)

## 1. Data Invariants
1. **Default Deny**: All paths not explicitly matched (`/users/{userId}`, `/admins/{adminId}`, `/attendance/{recordId}`, `/store_config/{configId}`) are strictly denied.
2. **Authentication & Email Verification**: All standard reads and writes require `request.auth != null` and `request.auth.token.email_verified == true`.
3. **Admin Authorization**: Admin status (`isAdmin()`) is only granted if `request.auth != null && request.auth.token.email_verified == true` and either:
   - `exists(/databases/$(database)/documents/admins/$(request.auth.uid))`, or
   - `request.auth.token.email in ['buihoai0412@gmail.com', 'phamthanhcong0412@gmail.com']`.
4. **PII Isolation (`/users/{userId}`)**: User documents contain PII (`email`, `phone`, `hourlyRate`, `password`). Read (`get`, `list`) access is strictly restricted to the document owner (`resource.data.ownerId == request.auth.uid`) or `isAdmin()`.
5. **Privilege Escalation Prevention**: Non-admin users creating their own profile (`userId == request.auth.uid`) MUST set `role == 'staff'`. Only `isAdmin()` can create or update a user with `role == 'admin'`, or modify `hourlyRate` and `role`.
6. **Temporal Integrity & Immutability**: `createdAt` must equal `request.time` on `create` and remain immutable on `update`. `updatedAt` must equal `request.time` on both `create` and `update`. `id` and `ownerId` are immutable on `update`.
7. **Terminal State Locking (`/attendance/{recordId}`)**: Once an attendance record reaches `status == 'completed'`, non-admin users cannot modify it (`existing().status == 'working' || isAdmin()`).

## 2. The "Dirty Dozen" Payloads

1. **Unauthenticated Write (`/users/user_1`)**: `auth = null`, attempts to create a user document -> `PERMISSION_DENIED`.
2. **Unverified Email Spoof (`/users/user_1`)**: `auth = { uid: 'u1', token: { email: 'buihoai0412@gmail.com', email_verified: false } }` -> `PERMISSION_DENIED`.
3. **Self-Assigned Admin Role (`/users/u2`)**: Non-admin user `u2` creates `/users/u2` with `role: 'admin'` -> `PERMISSION_DENIED`.
4. **Identity Spoofing on Create (`/users/u2`)**: User `u2` creates `/users/u2` with `ownerId: 'u1'` -> `PERMISSION_DENIED`.
5. **Shadow Field Injection (`/users/u2`)**: User `u2` creates `/users/u2` with an undeclared field `isSuperAdmin: true` -> `PERMISSION_DENIED`.
6. **PII Leak via Unauthorized Get (`/users/u1`)**: Authenticated staff user `u2` attempts `get(/users/u1)` where `ownerId == 'u1'` -> `PERMISSION_DENIED`.
7. **Blanket List Scraping (`/users`)**: Authenticated staff user `u2` attempts unconstrained `list(/users)` without `where('ownerId', '==', 'u2')` -> `PERMISSION_DENIED`.
8. **Role Escalation on Update (`/users/u2`)**: Staff user `u2` attempts to update `role: 'admin'` or `hourlyRate: 999999` on their own profile -> `PERMISSION_DENIED`.
9. **Immutable Field Mutation (`/users/u2`)**: User `u2` attempts to mutate `createdAt` or `ownerId` during `update` -> `PERMISSION_DENIED`.
10. **Forged Client Timestamp (`/attendance/att_1`)**: User `u2` creates attendance record with a past/future `createdAt` not matching `request.time` -> `PERMISSION_DENIED`.
11. **Terminal State Re-opening (`/attendance/att_1`)**: Staff user `u2` attempts to update an attendance record whose `status` is already `'completed'` -> `PERMISSION_DENIED`.
12. **Resource Poisoning / Oversized String (`/users/u2`)**: User `u2` sends a 5,000-character `name` string exceeding `maxLength: 120` -> `PERMISSION_DENIED`.
