# Branch Operations

<cite>
**Referenced Files in This Document**
- [branches.controller.ts](file://apps/api/src/modules/branches/branches.controller.ts)
- [branches.service.ts](file://apps/api/src/modules/branches/branches.service.ts)
- [branches.module.ts](file://apps/api/src/modules/branches/branches.module.ts)
- [schema.prisma](file://apps/api/prisma/schema.prisma)
- [seed_branches_and_zones.sql](file://database/seed_branches_and_zones.sql)
- [BranchesPage.tsx](file://apps/admin/src/pages/BranchesPage.tsx)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)

## Introduction
This document explains branch operational management across the system, focusing on how branches are created, listed, updated, and managed by administrators. It covers:
- CRUD operations for branches and their configurations
- Listing with pagination and filtering capabilities
- Status management (active/inactive)
- Delivery zone configuration per branch (delivery radius via polygon, base fee, free delivery threshold, surge pricing windows)
- Administrative workflows and controls for branch registration and maintenance

## Project Structure
The branch feature is implemented as a NestJS module with controllers, services, and Prisma-based data access. The admin UI provides a page to fetch and display branches.

```mermaid
graph TB
subgraph "API"
BC["BranchesController"]
ABC["AdminBranchesController"]
BS["BranchesService"]
PRISMA["PrismaService"]
end
subgraph "Database"
DB["PostgreSQL"]
BRANCH["public.Branch"]
ZONE["public.DeliveryZone"]
end
subgraph "Admin UI"
BP["BranchesPage.tsx"]
end
BP --> ABC
ABC --> BS
BC --> BS
BS --> PRISMA
PRISMA --> DB
DB --> BRANCH
DB --> ZONE
```

**Diagram sources**
- [branches.controller.ts:5-39](file://apps/api/src/modules/branches/branches.controller.ts#L5-L39)
- [branches.service.ts:5-56](file://apps/api/src/modules/branches/branches.service.ts#L5-L56)
- [schema.prisma:765-803](file://apps/api/prisma/schema.prisma#L765-L803)
- [BranchesPage.tsx:6-10](file://apps/admin/src/pages/BranchesPage.tsx#L6-L10)

**Section sources**
- [branches.controller.ts:1-40](file://apps/api/src/modules/branches/branches.controller.ts#L1-L40)
- [branches.service.ts:1-57](file://apps/api/src/modules/branches/branches.service.ts#L1-L57)
- [branches.module.ts:1-14](file://apps/api/src/modules/branches/branches.module.ts#L1-L14)
- [schema.prisma:765-803](file://apps/api/prisma/schema.prisma#L765-L803)
- [BranchesPage.tsx:1-31](file://apps/admin/src/pages/BranchesPage.tsx#L1-L31)

## Core Components
- Public listing endpoint returns only active branches sorted by name.
- Admin endpoints provide paginated listing, single branch retrieval, creation, and update.
- Data model includes branch identity, location, status, and associated delivery zones.

Key responsibilities:
- BranchesController: exposes REST routes for public and admin operations.
- AdminBranchesController: protected by admin guard; supports pagination via query parameters.
- BranchesService: encapsulates Prisma queries for listing, fetching, creating, and updating branches; includes related zones when retrieving a single branch.

**Section sources**
- [branches.controller.ts:9-38](file://apps/api/src/modules/branches/branches.controller.ts#L9-L38)
- [branches.service.ts:8-55](file://apps/api/src/modules/branches/branches.service.ts#L8-L55)
- [schema.prisma:765-803](file://apps/api/prisma/schema.prisma#L765-L803)

## Architecture Overview
The API follows a layered approach:
- Controllers define HTTP endpoints and parameter binding.
- Service layer performs business logic and data access using Prisma.
- Database schema defines Branch and DeliveryZone entities with relationships.

```mermaid
sequenceDiagram
participant AdminUI as "Admin UI"
participant Ctrl as "AdminBranchesController"
participant Svc as "BranchesService"
participant DB as "PrismaService"
participant Schema as "Branch/DeliveryZone"
AdminUI->>Ctrl : GET /admin/branches?page=1&limit=20
Ctrl->>Svc : adminListBranches(page, limit)
Svc->>DB : findMany({skip,take,orderBy})
DB-->>Svc : items[]
Svc->>DB : count()
DB-->>Svc : total
Svc-->>Ctrl : {data,total,page,limit,totalPages}
Ctrl-->>AdminUI : JSON response
```

**Diagram sources**
- [branches.controller.ts:20-23](file://apps/api/src/modules/branches/branches.controller.ts#L20-L23)
- [branches.service.ts:15-33](file://apps/api/src/modules/branches/branches.service.ts#L15-L33)
- [schema.prisma:765-803](file://apps/api/prisma/schema.prisma#L765-L803)

## Detailed Component Analysis

### Branch Data Model
- Branch fields include identifiers, bilingual names, geographic attributes (governorate, area, address, lat/lng), optional map embed source, load factor, and isActive flag.
- Each Branch has many DeliveryZone entries defining service areas and pricing rules.

```mermaid
erDiagram
BRANCH {
string id PK
string nameAr
string nameEn
string governorate
string area
string address
float lat
float lng
string mapEmbedSrc
float loadFactor
boolean isActive
datetime createdAt
datetime updatedAt
}
DELIVERYZONE {
string id PK
string branchId FK
string name
json polygon
int baseFee
int freeAboveSubtotal
int surgeStartHour
int surgeEndHour
float surgeMultiplier
datetime createdAt
datetime updatedAt
}
BRANCH ||--o{ DELIVERYZONE : "has many"
```

**Diagram sources**
- [schema.prisma:765-803](file://apps/api/prisma/schema.prisma#L765-L803)

**Section sources**
- [schema.prisma:765-803](file://apps/api/prisma/schema.prisma#L765-L803)

### Public Branch Listing
- Endpoint returns only active branches ordered by English name.
- Suitable for storefronts or customer-facing features that should not expose inactive locations.

```mermaid
flowchart TD
Start(["GET /branches"]) --> Filter["Filter where isActive = true"]
Filter --> Order["Order by nameEn ascending"]
Order --> Return["Return list of active branches"]
```

**Diagram sources**
- [branches.controller.ts:9-12](file://apps/api/src/modules/branches/branches.controller.ts#L9-L12)
- [branches.service.ts:8-13](file://apps/api/src/modules/branches/branches.service.ts#L8-L13)

**Section sources**
- [branches.controller.ts:9-12](file://apps/api/src/modules/branches/branches.controller.ts#L9-L12)
- [branches.service.ts:8-13](file://apps/api/src/modules/branches/branches.service.ts#L8-L13)

### Admin Branch Listing with Pagination
- Supports page and limit query parameters.
- Returns paginated results with metadata including total count and computed totalPages.

```mermaid
flowchart TD
A["GET /admin/branches?page&limit"] --> B["Compute skip = (page - 1) * limit"]
B --> C["Query items with skip/take and orderBy"]
C --> D["Query total count"]
D --> E["Build response: data, total, page, limit, totalPages"]
E --> F["Return JSON"]
```

**Diagram sources**
- [branches.controller.ts:20-23](file://apps/api/src/modules/branches/branches.controller.ts#L20-L23)
- [branches.service.ts:15-33](file://apps/api/src/modules/branches/branches.service.ts#L15-L33)

**Section sources**
- [branches.controller.ts:20-23](file://apps/api/src/modules/branches/branches.controller.ts#L20-L23)
- [branches.service.ts:15-33](file://apps/api/src/modules/branches/branches.service.ts#L15-L33)

### Get Single Branch with Zones
- Retrieves a branch by ID and includes its delivery zones for full context.
- Throws a not-found error if the branch does not exist.

```mermaid
sequenceDiagram
participant Admin as "Admin UI"
participant Ctrl as "AdminBranchesController"
participant Svc as "BranchesService"
participant DB as "PrismaService"
Admin->>Ctrl : GET /admin/branches/ : id
Ctrl->>Svc : getBranch(id)
Svc->>DB : findUnique({where : {id}, include : {zones}})
DB-->>Svc : Branch + zones
alt Not found
Svc-->>Ctrl : NotFoundException
Ctrl-->>Admin : 404
else Found
Svc-->>Ctrl : Branch + zones
Ctrl-->>Admin : 200 OK
end
```

**Diagram sources**
- [branches.controller.ts:25-28](file://apps/api/src/modules/branches/branches.controller.ts#L25-L28)
- [branches.service.ts:35-42](file://apps/api/src/modules/branches/branches.service.ts#L35-L42)

**Section sources**
- [branches.controller.ts:25-28](file://apps/api/src/modules/branches/branches.controller.ts#L25-L28)
- [branches.service.ts:35-42](file://apps/api/src/modules/branches/branches.service.ts#L35-L42)

### Create Branch
- Accepts a request body representing branch fields and persists via Prisma create.
- Use this endpoint to register new branches through administrative tools.

```mermaid
sequenceDiagram
participant Admin as "Admin UI"
participant Ctrl as "AdminBranchesController"
participant Svc as "BranchesService"
participant DB as "PrismaService"
Admin->>Ctrl : POST /admin/branches {branchData}
Ctrl->>Svc : createBranch(data)
Svc->>DB : create({data})
DB-->>Svc : Created branch
Svc-->>Ctrl : Branch object
Ctrl-->>Admin : 201 Created
```

**Diagram sources**
- [branches.controller.ts:30-33](file://apps/api/src/modules/branches/branches.controller.ts#L30-L33)
- [branches.service.ts:44-48](file://apps/api/src/modules/branches/branches.service.ts#L44-L48)

**Section sources**
- [branches.controller.ts:30-33](file://apps/api/src/modules/branches/branches.controller.ts#L30-L33)
- [branches.service.ts:44-48](file://apps/api/src/modules/branches/branches.service.ts#L44-L48)

### Update Branch
- Updates an existing branch identified by ID with provided fields.
- Ideal for modifying branch details, toggling isActive, or adjusting loadFactor.

```mermaid
sequenceDiagram
participant Admin as "Admin UI"
participant Ctrl as "AdminBranchesController"
participant Svc as "BranchesService"
participant DB as "PrismaService"
Admin->>Ctrl : PATCH /admin/branches/ : id {updates}
Ctrl->>Svc : updateBranch(id, data)
Svc->>DB : update({where : {id}, data})
DB-->>Svc : Updated branch
Svc-->>Ctrl : Branch object
Ctrl-->>Admin : 200 OK
```

**Diagram sources**
- [branches.controller.ts:35-38](file://apps/api/src/modules/branches/branches.controller.ts#L35-L38)
- [branches.service.ts:50-55](file://apps/api/src/modules/branches/branches.service.ts#L50-L55)

**Section sources**
- [branches.controller.ts:35-38](file://apps/api/src/modules/branches/branches.controller.ts#L35-L38)
- [branches.service.ts:50-55](file://apps/api/src/modules/branches/branches.service.ts#L50-L55)

### Delivery Zone Configuration (Delivery Radius and Pricing)
- Each branch can have multiple delivery zones defined by a polygon geometry.
- Pricing and availability per zone include base fee, free delivery threshold, and surge pricing windows.

```mermaid
flowchart TD
Start(["Configure Delivery Zone"]) --> Poly["Define polygon points"]
Poly --> Fees["Set baseFee and freeAboveSubtotal"]
Fees --> Surge{"Surge pricing?"}
Surge --> |Yes| Hours["Set surgeStartHour, surgeEndHour, surgeMultiplier"]
Surge --> |No| Save["Save zone"]
Hours --> Save
Save --> End(["Zone Active"])
```

**Diagram sources**
- [schema.prisma:786-803](file://apps/api/prisma/schema.prisma#L786-L803)
- [seed_branches_and_zones.sql:76-115](file://database/seed_branches_and_zones.sql#L76-L115)

**Section sources**
- [schema.prisma:786-803](file://apps/api/prisma/schema.prisma#L786-L803)
- [seed_branches_and_zones.sql:76-115](file://database/seed_branches_and_zones.sql#L76-L115)

### Branch Status Management
- Branches have an isActive flag to control visibility and availability.
- Public listing filters to active branches; admins can toggle status via updates.

```mermaid
stateDiagram-v2
[*] --> Inactive : "Create with isActive=false"
Inactive --> Active : "Update isActive=true"
Active --> Inactive : "Update isActive=false"
```

**Diagram sources**
- [schema.prisma:765-784](file://apps/api/prisma/schema.prisma#L765-L784)
- [branches.service.ts:8-13](file://apps/api/src/modules/branches/branches.service.ts#L8-L13)

**Section sources**
- [schema.prisma:765-784](file://apps/api/prisma/schema.prisma#L765-L784)
- [branches.service.ts:8-13](file://apps/api/src/modules/branches/branches.service.ts#L8-L13)

### Administrative Controls and Registration Workflow
- Admin endpoints are guarded to ensure only authorized users can manage branches.
- The admin UI fetches paginated branch data for review and actions.

```mermaid
sequenceDiagram
participant Admin as "Admin UI"
participant Guard as "AdminAuthGuard"
participant Ctrl as "AdminBranchesController"
participant Svc as "BranchesService"
Admin->>Guard : Request with credentials
Guard-->>Admin : Access granted/denied
Admin->>Ctrl : GET /admin/branches?page&limit
Ctrl->>Svc : adminListBranches(...)
Svc-->>Ctrl : Paginated result
Ctrl-->>Admin : Response
```

**Diagram sources**
- [branches.controller.ts:15-23](file://apps/api/src/modules/branches/branches.controller.ts#L15-L23)
- [BranchesPage.tsx:6-10](file://apps/admin/src/pages/BranchesPage.tsx#L6-L10)

**Section sources**
- [branches.controller.ts:15-23](file://apps/api/src/modules/branches/branches.controller.ts#L15-L23)
- [BranchesPage.tsx:6-10](file://apps/admin/src/pages/BranchesPage.tsx#L6-L10)

## Dependency Analysis
- BranchesModule imports PrismaModule and AuthModule to enable database access and admin authentication.
- Controllers depend on BranchesService for all branch operations.
- Service depends on PrismaService to interact with Branch and DeliveryZone models.

```mermaid
graph LR
BM["BranchesModule"] --> BC["BranchesController"]
BM --> ABC["AdminBranchesController"]
BM --> BS["BranchesService"]
BC --> BS
ABC --> BS
BS --> PM["PrismaModule"]
BM --> AM["AuthModule"]
```

**Diagram sources**
- [branches.module.ts:7-11](file://apps/api/src/modules/branches/branches.module.ts#L7-L11)
- [branches.controller.ts:1-7](file://apps/api/src/modules/branches/branches.controller.ts#L1-L7)
- [branches.service.ts:1-6](file://apps/api/src/modules/branches/branches.service.ts#L1-L6)

**Section sources**
- [branches.module.ts:1-14](file://apps/api/src/modules/branches/branches.module.ts#L1-L14)
- [branches.controller.ts:1-7](file://apps/api/src/modules/branches/branches.controller.ts#L1-L7)
- [branches.service.ts:1-6](file://apps/api/src/modules/branches/branches.service.ts#L1-L6)

## Performance Considerations
- Public listing filters by isActive and orders by nameEn to reduce client-side processing.
- Admin listing uses skip/take pagination to limit payload size and improve responsiveness.
- Including zones in single branch retrieval adds relational data; consider lazy-loading zones if performance becomes critical for large datasets.
- Ensure indexes on frequently filtered fields (e.g., isActive) and ordering columns (nameEn) at the database level if needed.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
- Not Found errors: When retrieving a branch by ID, a not-found exception is thrown if the branch does not exist. Verify the ID and existence in the database.
- Authentication issues: Admin endpoints require admin authentication; ensure proper credentials and roles are set before making requests.
- Pagination parameters: Ensure page and limit are valid integers; invalid values may cause unexpected behavior.

**Section sources**
- [branches.service.ts:35-42](file://apps/api/src/modules/branches/branches.service.ts#L35-L42)
- [branches.controller.ts:15-23](file://apps/api/src/modules/branches/branches.controller.ts#L15-L23)

## Conclusion
The branch operational management system provides robust CRUD capabilities with secure admin controls, pagination support, and rich delivery zone configuration. Branches can be registered, updated, and toggled between active and inactive states, while delivery zones define service areas and pricing policies. The architecture cleanly separates concerns across controllers, services, and data models, enabling scalable and maintainable operations.

[No sources needed since this section summarizes without analyzing specific files]