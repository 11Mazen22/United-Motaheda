# Orders Module

<cite>
**Referenced Files in This Document**
- [orderStatus.ts](file://packages/contracts/src/orderStatus.ts)
- [20260715150000_canonical_order_lifecycle.sql](file://supabase/migrations/20260715150000_canonical_order_lifecycle.sql)
- [schema.prisma](file://apps/api/prisma/schema.prisma)
- [driver-orders.service.ts](file://apps/api/src/modules/driver/driver-orders.service.ts)
- [create-order/index.ts](file://apps/shopper-native/supabase/functions/create-order/index.ts)
- [realtime.ts](file://apps/shopper-native/src/features/orders/realtime.ts)
- [fetchOrderTracking.ts](file://apps/shopper-native/src/features/orders/api/fetchOrderTracking.ts)
- [orders.store.ts](file://apps/courier-mobile/src/stores/orders.store.ts)
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
This document explains the Orders module end-to-end: how orders are created, validated, routed across branches and drivers, fulfilled, and tracked in real time. It covers the canonical order lifecycle, state transitions enforced at the database layer, API endpoints for driver workflows, real-time status updates, and analytics/reporting considerations. It also provides guidance on extending order types and integrating payments and inventory reservation.

## Project Structure
The Orders module spans several layers:
- Contracts define the canonical order statuses and allowed transitions.
- Database migrations enforce a strict transition graph via a security-definer function.
- The Prisma schema models orders, order items, and related entities (profiles, delivery assignments).
- Driver service implements order assignment and fulfillment workflow with geofencing and broadcasting.
- Client apps consume order APIs and subscribe to real-time updates.

```mermaid
graph TB
subgraph "Contracts"
C1["Canonical statuses<br/>and transitions"]
end
subgraph "Database"
D1["Orders table"]
D2["Order items"]
D3["DeliveryAssignment"]
D4["Transition RPC"]
end
subgraph "API"
A1["DriverOrdersService"]
end
subgraph "Clients"
CL1["Shopper Native"]
CL2["Courier Mobile"]
end
C1 --> D4
D4 --> D1
A1 --> D1
A1 --> D3
CL1 --> A1
CL2 --> A1
D1 --> CL1
D1 --> CL2
```

**Diagram sources**
- [orderStatus.ts:59-167](file://packages/contracts/src/orderStatus.ts#L59-L167)
- [20260715150000_canonical_order_lifecycle.sql:16-40](file://supabase/migrations/20260715150000_canonical_order_lifecycle.sql#L16-L40)
- [schema.prisma:540-592](file://apps/api/prisma/schema.prisma#L540-L592)
- [driver-orders.service.ts:74-322](file://apps/api/src/modules/driver/driver-orders.service.ts#L74-L322)

**Section sources**
- [orderStatus.ts:59-167](file://packages/contracts/src/orderStatus.ts#L59-L167)
- [20260715150000_canonical_order_lifecycle.sql:16-40](file://supabase/migrations/20260715150000_canonical_order_lifecycle.sql#L16-L40)
- [schema.prisma:540-592](file://apps/api/prisma/schema.prisma#L540-L592)

## Core Components
- Canonical order lifecycle and transitions: single source of truth for statuses and allowed moves.
- Database transition enforcement: a security-definer function validates transitions and updates timestamps.
- Order data model: orders, order_items, profiles, and delivery assignments.
- Driver workflow service: available orders listing, acceptance, rejection, and step-by-step fulfillment with geofencing and broadcast events.
- Real-time tracking: client subscriptions and tracking endpoints.

Key responsibilities:
- Enforce valid state changes at the DB layer.
- Provide driver-facing endpoints for assignment and fulfillment.
- Keep clients synchronized via real-time updates.

**Section sources**
- [orderStatus.ts:59-167](file://packages/contracts/src/orderStatus.ts#L59-L167)
- [20260715150000_canonical_order_lifecycle.sql:16-40](file://supabase/migrations/20260715150000_canonical_order_lifecycle.sql#L16-L40)
- [schema.prisma:540-592](file://apps/api/prisma/schema.prisma#L540-L592)
- [driver-orders.service.ts:74-322](file://apps/api/src/modules/driver/driver-orders.service.ts#L74-L322)

## Architecture Overview
The order lifecycle is governed by a canonical contract and enforced by a database function. Driver operations update both order status and delivery assignment states, then broadcast changes to admins and clients.

```mermaid
sequenceDiagram
participant Client as "Client App"
participant API as "DriverOrdersService"
participant DB as "Prisma/Postgres"
participant RT as "Broadcast Gateway"
Client->>API : GET /driver/orders/available
API->>DB : Query ready orders
DB-->>API : Orders list
API-->>Client : Available orders
Client->>API : POST /driver/orders/{id}/accept
API->>DB : Create DeliveryAssignment + Update Order status
DB-->>API : Success
API->>RT : Broadcast order-assigned
RT-->>Client : Real-time update
Client->>API : POST /driver/orders/{id}/complete
API->>DB : Mark assignment delivered + Update Order status
DB-->>API : Success
API->>RT : Broadcast delivery-status-update
RT-->>Client : Real-time update
```

**Diagram sources**
- [driver-orders.service.ts:74-183](file://apps/api/src/modules/driver/driver-orders.service.ts#L74-L183)
- [driver-orders.service.ts:187-295](file://apps/api/src/modules/driver/driver-orders.service.ts#L187-L295)
- [driver-orders.service.ts:435-510](file://apps/api/src/modules/driver/driver-orders.service.ts#L435-L510)

## Detailed Component Analysis

### Canonical Order Lifecycle and Transitions
- Defines all canonical statuses, labels, normalization helpers, and the complete allowed transition graph.
- Provides utilities to check if a transition is allowed and whether a status is terminal.

```mermaid
flowchart TD
Start(["Order Created"]) --> Pending["pending"]
Pending --> Verification{"Payment verification?"}
Verification --> |Yes| PaymentPending["payment_pending"]
PaymentPending --> PaymentApproved["payment_approved"]
Verification --> |No| Preparing["preparing"]
PaymentApproved --> Preparing
Preparing --> Ready["ready"]
Ready --> DriverAssigned["driver_assigned"]
DriverAssigned --> DriverAccepted["driver_accepted"]
DriverAccepted --> OutForDelivery["out_for_delivery"]
OutForDelivery --> Delivered["delivered"]
Delivered --> Archived["archived"]
Pending --> Cancelled["cancelled"]
Preparing --> Cancelled
Ready --> Cancelled
OutForDelivery --> Cancelled
Cancelled --> Archived
```

**Diagram sources**
- [orderStatus.ts:59-167](file://packages/contracts/src/orderStatus.ts#L59-L167)

**Section sources**
- [orderStatus.ts:59-167](file://packages/contracts/src/orderStatus.ts#L59-L167)

### Database Transition Enforcement
- A security-definer function enforces the canonical transition graph and updates timestamps atomically.
- Only authorized roles can invoke it; invalid transitions raise specific errors.

```mermaid
flowchart TD
Enter(["admin_transition_order(orderId, nextStatus)"]) --> CheckRole["Check role"]
CheckRole --> LockOrder["Lock order row"]
LockOrder --> ValidateTrans["Validate against allowed transitions"]
ValidateTrans --> |Invalid| RaiseErr["Raise error"]
ValidateTrans --> |Valid| UpdateOrder["Update status + timestamps"]
UpdateOrder --> ReturnOrder["Return updated order"]
```

**Diagram sources**
- [20260715150000_canonical_order_lifecycle.sql:16-40](file://supabase/migrations/20260715150000_canonical_order_lifecycle.sql#L16-L40)

**Section sources**
- [20260715150000_canonical_order_lifecycle.sql:16-40](file://supabase/migrations/20260715150000_canonical_order_lifecycle.sql#L16-L40)

### Order Data Model and Relationships
- Orders link to customers via profile relationships and store shipping/payment metadata.
- Order items snapshot product details and quantities at time of purchase.
- DeliveryAssignment ties an order to a driver and tracks fulfillment steps.

```mermaid
erDiagram
ORDERS {
uuid id PK
string status
decimal subtotal
decimal total
string payment_method
string payment_status
uuid user_id FK
uuid assigned_driver_id FK
}
ORDER_ITEMS {
bigint id PK
uuid order_id FK
uuid product_id FK
decimal quantity
decimal unit_price
json product_snapshot
}
PROFILES {
uuid id PK
string full_name
string phone
enum role
}
DELIVERY_ASSIGNMENT {
uuid id PK
uuid order_id FK
uuid driver_id FK
string status
timestamp accepted_at
timestamp delivered_at
}
ORDERS ||--o{ ORDER_ITEMS : "has many"
PROFILES ||--o{ ORDERS : "owns"
PROFILES ||--o{ DELIVERY_ASSIGNMENT : "fulfills"
ORDERS ||--|| DELIVERY_ASSIGNMENT : "assigned"
```

**Diagram sources**
- [schema.prisma:540-592](file://apps/api/prisma/schema.prisma#L540-L592)

**Section sources**
- [schema.prisma:540-592](file://apps/api/prisma/schema.prisma#L540-L592)

### Driver Workflow Service
Responsibilities include:
- Listing available orders for drivers.
- Accepting/rejecting orders with concurrency-safe transactions.
- Advancing fulfillment states with geofence checks.
- Completing deliveries, recording earnings, and broadcasting updates.

```mermaid
sequenceDiagram
participant Driver as "Driver App"
participant Svc as "DriverOrdersService"
participant DB as "Postgres"
participant GW as "Gateway"
Driver->>Svc : getAvailableOrders()
Svc->>DB : Find ready, unassigned orders
DB-->>Svc : Orders
Svc-->>Driver : List
Driver->>Svc : acceptOrder(id)
Svc->>DB : Create assignment + update order status
DB-->>Svc : Success
Svc->>GW : Broadcast order-assigned
Svc-->>Driver : Assignment + order
Driver->>Svc : markPickedUp(id)
Svc->>DB : Update assignment + order status
DB-->>Svc : Success
Svc->>GW : Broadcast delivery-status-update
Driver->>Svc : completeDelivery(id, proof)
Svc->>DB : Mark delivered + create earnings
DB-->>Svc : Success
Svc->>GW : Broadcast delivery-status-update
```

**Diagram sources**
- [driver-orders.service.ts:74-183](file://apps/api/src/modules/driver/driver-orders.service.ts#L74-L183)
- [driver-orders.service.ts:187-295](file://apps/api/src/modules/driver/driver-orders.service.ts#L187-L295)
- [driver-orders.service.ts:382-433](file://apps/api/src/modules/driver/driver-orders.service.ts#L382-L433)
- [driver-orders.service.ts:435-510](file://apps/api/src/modules/driver/driver-orders.service.ts#L435-L510)

**Section sources**
- [driver-orders.service.ts:74-183](file://apps/api/src/modules/driver/driver-orders.service.ts#L74-L183)
- [driver-orders.service.ts:187-295](file://apps/api/src/modules/driver/driver-orders.service.ts#L187-L295)
- [driver-orders.service.ts:382-433](file://apps/api/src/modules/driver/driver-orders.service.ts#L382-L433)
- [driver-orders.service.ts:435-510](file://apps/api/src/modules/driver/driver-orders.service.ts#L435-L510)

### Order Creation and Payment Integration
- Orders are created via a Supabase Edge Function that sets initial status and integrates with payment flows (e.g., manual wallet verification).
- Statuses such as payment_pending and payment_approved reflect manual payment verification stages before fulfillment begins.

```mermaid
sequenceDiagram
participant Shopper as "Shopper App"
participant FN as "Create Order Function"
participant DB as "Postgres"
participant Pay as "Payment Provider"
Shopper->>FN : Submit checkout payload
FN->>Pay : Authorize/Verify (if applicable)
Pay-->>FN : Result
FN->>DB : Create order + set status (pending/payment_pending)
DB-->>FN : Order created
FN-->>Shopper : Order ID + status
```

**Diagram sources**
- [create-order/index.ts](file://apps/shopper-native/supabase/functions/create-order/index.ts)
- [orderStatus.ts:59-167](file://packages/contracts/src/orderStatus.ts#L59-L167)

**Section sources**
- [create-order/index.ts](file://apps/shopper-native/supabase/functions/create-order/index.ts)
- [orderStatus.ts:59-167](file://packages/contracts/src/orderStatus.ts#L59-L167)

### Real-Time Status Updates and Tracking
- Clients subscribe to real-time channels to receive live order status changes.
- Tracking endpoints provide snapshots of location and status for active deliveries.

```mermaid
sequenceDiagram
participant Client as "Shopper/Courier App"
participant RT as "Realtime Channel"
participant API as "DriverOrdersService"
participant DB as "Postgres"
Client->>RT : Subscribe to order updates
API->>DB : Update order/assignment status
API->>RT : Emit delivery-status-update
RT-->>Client : Live status change
Client->>API : Fetch tracking snapshot
API-->>Client : Tracking data
```

**Diagram sources**
- [realtime.ts](file://apps/shopper-native/src/features/orders/realtime.ts)
- [fetchOrderTracking.ts](file://apps/shopper-native/src/features/orders/api/fetchOrderTracking.ts)
- [driver-orders.service.ts:613-619](file://apps/api/src/modules/driver/driver-orders.service.ts#L613-L619)

**Section sources**
- [realtime.ts](file://apps/shopper-native/src/features/orders/realtime.ts)
- [fetchOrderTracking.ts](file://apps/shopper-native/src/features/orders/api/fetchOrderTracking.ts)
- [driver-orders.service.ts:613-619](file://apps/api/src/modules/driver/driver-orders.service.ts#L613-L619)

### Order History and Courier View
- Drivers view their active delivery and delivery history through dedicated queries.
- Courier mobile stores expose order structures for UI rendering.

```mermaid
sequenceDiagram
participant Driver as "Driver App"
participant Svc as "DriverOrdersService"
participant DB as "Postgres"
Driver->>Svc : getActiveDelivery(userId)
Svc->>DB : Query assignment + order
DB-->>Svc : Active delivery
Svc-->>Driver : Active delivery details
Driver->>Svc : getDeliveryHistory(userId, page, limit)
Svc->>DB : Paginated delivered assignments
DB-->>Svc : History
Svc-->>Driver : History list
```

**Diagram sources**
- [driver-orders.service.ts:326-378](file://apps/api/src/modules/driver/driver-orders.service.ts#L326-L378)
- [driver-orders.service.ts:514-554](file://apps/api/src/modules/driver/driver-orders.service.ts#L514-L554)
- [orders.store.ts](file://apps/courier-mobile/src/stores/orders.store.ts)

**Section sources**
- [driver-orders.service.ts:326-378](file://apps/api/src/modules/driver/driver-orders.service.ts#L326-L378)
- [driver-orders.service.ts:514-554](file://apps/api/src/modules/driver/driver-orders.service.ts#L514-L554)
- [orders.store.ts](file://apps/courier-mobile/src/stores/orders.store.ts)

## Dependency Analysis
- Contracts depend only on TypeScript types and constants.
- Database migration depends on Postgres and defines the authoritative transition logic.
- Driver service depends on Prisma and a gateway for broadcasts.
- Client features depend on services and realtime channels.

```mermaid
graph LR
Contracts["Contracts (statuses/transitions)"] --> Migration["DB Transition Function"]
Migration --> Schema["Prisma Models"]
DriverSvc["DriverOrdersService"] --> Schema
DriverSvc --> Gateway["Broadcast Gateway"]
Clients["Shopper/Courier Apps"] --> DriverSvc
Clients --> Realtime["Realtime Channels"]
```

**Diagram sources**
- [orderStatus.ts:59-167](file://packages/contracts/src/orderStatus.ts#L59-L167)
- [20260715150000_canonical_order_lifecycle.sql:16-40](file://supabase/migrations/20260715150000_canonical_order_lifecycle.sql#L16-L40)
- [schema.prisma:540-592](file://apps/api/prisma/schema.prisma#L540-L592)
- [driver-orders.service.ts:613-619](file://apps/api/src/modules/driver/driver-orders.service.ts#L613-L619)

**Section sources**
- [orderStatus.ts:59-167](file://packages/contracts/src/orderStatus.ts#L59-L167)
- [20260715150000_canonical_order_lifecycle.sql:16-40](file://supabase/migrations/20260715150000_canonical_order_lifecycle.sql#L16-L40)
- [schema.prisma:540-592](file://apps/api/prisma/schema.prisma#L540-L592)
- [driver-orders.service.ts:613-619](file://apps/api/src/modules/driver/driver-orders.service.ts#L613-L619)

## Performance Considerations
- Use indexed queries for orders by status and created_at to optimize listing and pagination.
- Keep driver availability checks and distance calculations server-side to reduce client overhead.
- Batch real-time broadcasts to avoid flooding clients during high-volume transitions.
- Snapshot product data in order_items to prevent read amplification on catalog changes.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and resolutions:
- Invalid state transition: occurs when attempting an unsupported move; ensure transitions follow the canonical graph or use the admin transition function.
- Driver not online: acceptance requires driver to be marked online; verify driver profile status.
- Geofence validation failures: arrival actions require proximity to pharmacy/customer; confirm GPS coordinates and radius thresholds.
- Concurrency conflicts: multiple drivers may attempt to accept the same order; rely on transactional locks and unique constraints to prevent double assignment.
- Realtime disconnects: handle reconnection and replay last known status from polling or stored timeline.

**Section sources**
- [20260715150000_canonical_order_lifecycle.sql:16-40](file://supabase/migrations/20260715150000_canonical_order_lifecycle.sql#L16-L40)
- [driver-orders.service.ts:68-70](file://apps/api/src/modules/driver/driver-orders.service.ts#L68-L70)
- [driver-orders.service.ts:386-400](file://apps/api/src/modules/driver/driver-orders.service.ts#L386-L400)
- [driver-orders.service.ts:413-433](file://apps/api/src/modules/driver/driver-orders.service.ts#L413-L433)

## Conclusion
The Orders module enforces a robust, canonical lifecycle with database-level transition guards, a clear driver workflow for fulfillment, and real-time updates for transparency. By centralizing statuses and transitions, the system ensures consistency across admin panels, driver apps, and customer interfaces. Extending order types should reuse the canonical statuses and add domain-specific fields while preserving the core transition graph.

[No sources needed since this section summarizes without analyzing specific files]