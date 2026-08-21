# Architecture Guide

<cite>
**Referenced Files in This Document**
- [package.json](file://package.json)
- [README.md](file://README.md)
- [apps/api/package.json](file://apps/api/package.json)
- [apps/admin/package.json](file://apps/admin/package.json)
- [apps/shopper-web/package.json](file://apps/shopper-web/package.json)
- [apps/api/src/main.ts](file://apps/api/src/main.ts)
- [apps/api/src/app.module.ts](file://apps/api/src/app.module.ts)
- [apps/api/src/auth/auth.module.ts](file://apps/api/src/auth/auth.module.ts)
- [apps/api/src/auth/supabase-auth.service.ts](file://apps/api/src/auth/supabase-auth.service.ts)
- [packages/api-client/package.json](file://packages/api-client/package.json)
- [supabase/functions/notification-worker/index.ts](file://supabase/functions/notification-worker/index.ts)
</cite>

## Table of Contents
1. Introduction
2. Project Structure
3. Core Components
4. Architecture Overview
5. Detailed Component Analysis
6. Dependency Analysis
7. Performance Considerations
8. Troubleshooting Guide
9. Conclusion

## Introduction
This document describes the architecture of the United Pharmacy Monorepo system. It explains how Domain-Driven Design principles are applied across a monorepo built with npm workspaces, and how frontend applications, backend API, shared domain logic, and UI libraries are separated to maintain clarity and scalability. It also details data flow from user interactions through API calls to database operations and real-time updates, authentication and authorization using Supabase JWT tokens and role-based access control, integration points with external services (Supabase and Firebase), deployment topology, and considerations for scalability, performance, and security.

## Project Structure
The repository is an npm workspaces monorepo that organizes multiple apps and shared packages:
- Apps: shopper web, admin dashboard, courier mobile, cashier mobile, customer mobile shells
- Packages: api client, contracts, design tokens, domain modules (account, cart, catalog, checkout, core, courier, location, ops, orders, prescriptions, search), types, UI libraries (web and native)

```mermaid
graph TB
subgraph "Apps"
A["apps/shopper-web"]
B["apps/admin"]
C["apps/courier-mobile"]
D["apps/cashier-mobile"]
E["apps/customer-mobile"]
end
subgraph "Packages"
P1["packages/api-client"]
P2["packages/contracts"]
P3["packages/domain-*"]
P4["packages/ui-web"]
P5["packages/ui-native"]
P6["packages/design-tokens"]
P7["packages/types"]
end
subgraph "Backend"
S["apps/api (NestJS)"]
end
subgraph "External Services"
X1["Supabase (Auth, DB, Edge Functions)"]
X2["Firebase Admin (FCM)"]
end
A --> P1
B --> P1
C --> P1
D --> P1
E --> P1
A --> S
B --> S
C --> S
D --> S
E --> S
S --> X1
S --> X2
```

**Diagram sources**
- [package.json:9-13](file://package.json#L9-L13)
- [README.md:7-15](file://README.md#L7-L15)

**Section sources**
- [package.json:9-13](file://package.json#L9-L13)
- [README.md:7-15](file://README.md#L7-L15)

## Core Components
- Backend API: NestJS application exposing REST endpoints and WebSockets, integrated with Prisma and Supabase Auth.
- Frontend Apps: React-based web and mobile shells consuming a shared API client and domain packages.
- Shared Domain Logic: Feature-focused packages encapsulating business rules and state models (e.g., orders, catalog, search).
- UI Libraries: Reusable components and design tokens for web and native platforms.
- External Integrations: Supabase for auth, database, edge functions; Firebase Admin for push notifications.

Key responsibilities:
- apps/api: orchestrates modules, global interceptors/filters, CORS, and routes to domain modules.
- packages/api-client: centralized HTTP client and request/response contracts used by all apps.
- packages/domain-*: pure domain logic and shared state patterns (e.g., search, location).
- supabase/functions: background workers (e.g., notification outbox processing).

**Section sources**
- [apps/api/package.json:14-35](file://apps/api/package.json#L14-L35)
- [packages/api-client/package.json:1-20](file://packages/api-client/package.json#L1-L20)
- [README.md:17-24](file://README.md#L17-L24)

## Architecture Overview
High-level architecture follows Domain-Driven Design with clear boundaries:
- Presentation Layer: apps (shopper-web, admin, mobile shells)
- Application/API Layer: NestJS modules per domain feature
- Domain Layer: packages/domain-* containing business rules and shared state
- Infrastructure Layer: Prisma/Postgres, Supabase Auth/DB, Firebase Admin, Socket.IO/WebSockets

```mermaid
graph TB
Client["Frontend Apps<br/>shopper-web, admin, mobile shells"]
API["NestJS API<br/>modules: auth, products, inventory, delivery, driver, notifications, admin"]
Domain["Domain Packages<br/>domain-core, domain-orders, domain-catalog, domain-search, etc."]
Infra["Infrastructure<br/>Prisma/Postgres, Supabase Auth & DB, Firebase Admin, Socket.IO"]
Client --> API
API --> Domain
API --> Infra
Client --> Infra
```

**Diagram sources**
- [apps/api/src/app.module.ts:14-27](file://apps/api/src/app.module.ts#L14-L27)
- [apps/api/package.json:14-35](file://apps/api/package.json#L14-L35)
- [README.md:17-24](file://README.md#L17-L24)

## Detailed Component Analysis

### Backend API (NestJS)
- Bootstrap: initializes Nest app, configures CORS with explicit origins, applies global response interceptor and exception filter, listens on port.
- Module Composition: imports feature modules (auth, branches, delivery, promotion-copilot, driver, notifications, admin, products, inventory, customers) and Prisma module.
- Security: CORS configured for production domains and localhost; credentials enabled; preflight caching.

```mermaid
sequenceDiagram
participant FE as "Frontend App"
participant API as "NestJS Main"
participant MOD as "Feature Modules"
participant DB as "Prisma/Postgres"
participant SA as "Supabase Auth"
FE->>API : HTTP Request
API->>API : Global Interceptors/Filters
API->>MOD : Route Handler
MOD->>SA : Validate Token / Get User
MOD->>DB : Query/Write Data
DB-->>MOD : Result
MOD-->>API : Response DTO
API-->>FE : JSON Response
```

**Diagram sources**
- [apps/api/src/main.ts:7-35](file://apps/api/src/main.ts#L7-L35)
- [apps/api/src/app.module.ts:14-27](file://apps/api/src/app.module.ts#L14-L27)

**Section sources**
- [apps/api/src/main.ts:7-35](file://apps/api/src/main.ts#L7-L35)
- [apps/api/src/app.module.ts:14-27](file://apps/api/src/app.module.ts#L14-L27)

### Authentication and Authorization
- SupabaseAuthService handles sign-in, user creation, and token validation. It uses service-role client to interact with Supabase Auth and fetches profiles via Prisma.
- Guards: AdminAuthGuard, DriverAuthGuard, RoleAuthGuard provide role-based access control at route level.
- Flow: clients send requests with Supabase JWT; API validates token via Supabase; profile resolved from Postgres; guards enforce roles.

```mermaid
sequenceDiagram
participant Client as "Client"
participant Auth as "SupabaseAuthService"
participant Guard as "Role Guards"
participant DB as "Prisma/Postgres"
Client->>Auth : signIn(identifier, password)
Auth->>Auth : resolveEmail()
Auth-->>Client : session/user
Client->>Auth : authenticateAccessToken(token)
Auth->>DB : find profile by userId
DB-->>Auth : profile + driverProfile
Auth-->>Client : AuthenticatedUser
Client->>Guard : request protected resource
Guard->>Auth : verify role/permissions
Guard-->>Client : allow/deny
```

**Diagram sources**
- [apps/api/src/auth/supabase-auth.service.ts:26-64](file://apps/api/src/auth/supabase-auth.service.ts#L26-L64)
- [apps/api/src/auth/auth.module.ts:8-12](file://apps/api/src/auth/auth.module.ts#L8-L12)

**Section sources**
- [apps/api/src/auth/supabase-auth.service.ts:26-64](file://apps/api/src/auth/supabase-auth.service.ts#L26-L64)
- [apps/api/src/auth/auth.module.ts:8-12](file://apps/api/src/auth/auth.module.ts#L8-L12)

### Real-Time Updates and Notifications
- WebSockets: NestJS integrates Socket.IO for real-time features (e.g., order tracking, live updates).
- Notification Worker: Supabase Edge Function processes an outbox table, sends push notifications via Expo, tracks delivery attempts, and handles receipts to mark delivered or failed messages.

```mermaid
flowchart TD
Start(["Notification Outbound"]) --> Claim["Claim Jobs from Outbox"]
Claim --> CheckPrefs{"Preferences Allow Push?"}
CheckPrefs --> |No| Skip["Mark Skipped"]
CheckPrefs --> |Yes| Tokens["Fetch Active Device Tokens"]
Tokens --> HasTokens{"Any Tokens?"}
HasTokens --> |No| Skip
HasTokens --> |Yes| Send["Send Push via Expo"]
Send --> Record["Record Delivery Attempts"]
Record --> UpdateStatus{"Any Accepted?"}
UpdateStatus --> |Yes| MarkSent["Mark Sent"]
UpdateStatus --> |No| Retry["Retry with Backoff"]
MarkSent --> End(["Done"])
Retry --> End
Skip --> End
```

**Diagram sources**
- [supabase/functions/notification-worker/index.ts:37-125](file://supabase/functions/notification-worker/index.ts#L37-L125)

**Section sources**
- [supabase/functions/notification-worker/index.ts:37-125](file://supabase/functions/notification-worker/index.ts#L37-L125)

### Data Flow: User Interaction to Database
- Frontend apps use a shared API client to call backend endpoints.
- Backend modules validate input, enforce auth/roles, perform domain logic, and persist changes via Prisma.
- Real-time channels broadcast updates to subscribed clients.

```mermaid
sequenceDiagram
participant UI as "UI Layer"
participant AC as "API Client"
participant API as "NestJS API"
participant DM as "Domain Module"
participant DB as "Prisma/Postgres"
participant WS as "Socket.IO"
UI->>AC : Dispatch action
AC->>API : HTTP Request
API->>DM : Handle business logic
DM->>DB : Read/Write
DB-->>DM : Data
DM-->>API : Response
API-->>AC : JSON
AC-->>UI : State update
API->>WS : Emit event
WS-->>UI : Real-time update
```

**Diagram sources**
- [packages/api-client/package.json:16-19](file://packages/api-client/package.json#L16-L19)
- [apps/api/src/app.module.ts:14-27](file://apps/api/src/app.module.ts#L14-L27)

**Section sources**
- [packages/api-client/package.json:16-19](file://packages/api-client/package.json#L16-L19)
- [apps/api/src/app.module.ts:14-27](file://apps/api/src/app.module.ts#L14-L27)

### System Boundaries and Integration Points
- Boundary: Frontend apps communicate only via the API client and WebSockets; no direct DB access.
- Integrations:
  - Supabase: Auth (JWT), Database (Postgres), Edge Functions (background workers)
  - Firebase Admin: Push notifications via FCM (used alongside Expo where applicable)
  - Socket.IO: Real-time communication between API and clients

**Section sources**
- [apps/api/package.json:14-35](file://apps/api/package.json#L14-L35)
- [supabase/functions/notification-worker/index.ts:37-125](file://supabase/functions/notification-worker/index.ts#L37-L125)

### Deployment Topology
- API runs on Node.js (NestJS) behind a reverse proxy (e.g., Railway), with CORS explicitly configured for production domains.
- Frontend apps are static builds served via CDN or hosting platform.
- Supabase Edge Functions run serverless within Supabase’s runtime.
- Mobile apps consume the same API client and WebSockets.

```mermaid
graph TB
FE["Web/Mobile Clients"]
CDN["CDN/Hosting"]
API["NestJS API (Railway)"]
DB["Postgres (Supabase)"]
AUTH["Supabase Auth"]
FUNC["Supabase Edge Functions"]
FCM["Firebase Admin"]
FE --> CDN
CDN --> API
API --> DB
API --> AUTH
API --> FUNC
FUNC --> DB
API --> FCM
```

**Diagram sources**
- [apps/api/src/main.ts:13-28](file://apps/api/src/main.ts#L13-L28)
- [apps/api/package.json:14-35](file://apps/api/package.json#L14-L35)

**Section sources**
- [apps/api/src/main.ts:13-28](file://apps/api/src/main.ts#L13-L28)
- [apps/api/package.json:14-35](file://apps/api/package.json#L14-L35)

## Dependency Analysis
- Workspaces: Root package.json defines workspaces for apps and packages, enabling shared dependencies and unified scripts.
- API Dependencies: NestJS ecosystem, Prisma, Supabase JS, Firebase Admin, Socket.IO, Zod for validation.
- Client Dependencies: Axios and contracts package for typed requests/responses.
- App Dependencies: Vite/React for web, mobile frameworks for native apps.

```mermaid
graph LR
Root["Root package.json (workspaces)"]
API["apps/api"]
Web["apps/shopper-web"]
Admin["apps/admin"]
Client["packages/api-client"]
Contracts["packages/contracts"]
Root --> API
Root --> Web
Root --> Admin
Web --> Client
Admin --> Client
Client --> Contracts
```

**Diagram sources**
- [package.json:9-13](file://package.json#L9-L13)
- [apps/api/package.json:14-35](file://apps/api/package.json#L14-L35)
- [packages/api-client/package.json:16-19](file://packages/api-client/package.json#L16-L19)

**Section sources**
- [package.json:9-13](file://package.json#L9-L13)
- [apps/api/package.json:14-35](file://apps/api/package.json#L14-L35)
- [packages/api-client/package.json:16-19](file://packages/api-client/package.json#L16-L19)

## Performance Considerations
- CORS Optimization: Preflight responses cached for 24 hours to reduce OPTIONS overhead.
- Real-Time Efficiency: Use WebSockets for live updates instead of polling; batch events where possible.
- Database Access: Leverage Prisma queries efficiently; ensure indexes exist for frequent lookups.
- Background Processing: Offload heavy tasks (e.g., push notifications) to Supabase Edge Functions with retry/backoff.
- Client-Side Caching: Utilize TanStack Query and local stores to minimize redundant requests.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
- Authentication Failures:
  - Invalid/expired tokens result in unauthorized exceptions; verify token validity and refresh strategy.
  - Profile not found indicates mismatched user IDs; ensure consistent identity mapping between Supabase Auth and Postgres profiles.
- CORS Errors:
  - Ensure requests originate from allowed domains; check browser console for preflight failures.
- Notification Delivery Issues:
  - Review outbox status and delivery attempts; handle device invalidation when receipts report errors.

**Section sources**
- [apps/api/src/auth/supabase-auth.service.ts:49-64](file://apps/api/src/auth/supabase-auth.service.ts#L49-L64)
- [apps/api/src/main.ts:13-28](file://apps/api/src/main.ts#L13-L28)
- [supabase/functions/notification-worker/index.ts:102-125](file://supabase/functions/notification-worker/index.ts#L102-L125)

## Conclusion
The United Pharmacy Monorepo employs Domain-Driven Design within an npm workspaces structure to separate concerns across frontend apps, backend API, shared domain logic, and UI libraries. The NestJS API enforces secure, role-based access using Supabase JWTs and integrates with Postgres via Prisma. Real-time updates and background processing are handled through WebSockets and Supabase Edge Functions. The architecture supports scalability through modular services, efficient caching, and offloading heavy tasks to serverless functions. Security is maintained via strict CORS policies, token validation, and role-based guards.