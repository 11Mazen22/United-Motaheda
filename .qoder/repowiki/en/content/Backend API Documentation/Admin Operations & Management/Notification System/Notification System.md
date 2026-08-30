# Notification System

<cite>
**Referenced Files in This Document**
- [index.ts](file://supabase/functions/notification-worker/index.ts)
- [index.ts](file://supabase/functions/sms-campaign-worker/index.ts)
- [notifications.service.ts](file://apps/api/src/modules/notifications/notifications.service.ts)
- [notifications.controller.ts](file://apps/api/src/modules/notifications/notifications.controller.ts)
- [broadcast.dto.ts](file://apps/api/src/modules/notifications/dto/broadcast.dto.ts)
- [20260713090000_notification_delivery_pipeline.sql](file://supabase/migrations/20260713090000_notification_delivery_pipeline.sql)
- [20260728120000_sms_marketing.sql](file://supabase/migrations/20260728120000_sms_marketing.sql)
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
10. [Appendices](#appendices)

## Introduction
This document explains the multi-channel notification system that supports push notifications, SMS campaigns, and background delivery workers. It covers:
- Push notifications via a durable outbox pipeline with retry and receipt tracking
- SMS marketing campaigns with batched processing and audit logging
- Admin APIs for broadcast and token management
- Scheduling concepts, recipient list management, and delivery status tracking
- Rate limiting, retries, analytics, external provider integration, and fallback strategies

## Project Structure
The notification system spans three layers:
- API layer (NestJS): token registration, broadcast endpoints, and direct push sending
- Edge functions (Supabase): background workers for push delivery and SMS campaign batching
- Database schema: durable outbox tables, delivery attempts, SMS campaign tables, and RPCs

```mermaid
graph TB
subgraph "API Layer"
C["NotificationsController"]
S["NotificationsService"]
end
subgraph "Edge Functions"
PW["Push Worker (notification-worker)"]
SW["SMS Campaign Worker (sms-campaign-worker)"]
end
subgraph "Database"
T["notification_tokens"]
O["notification_outbox"]
A["notification_delivery_attempts"]
SC["sms_campaigns"]
SR["sms_campaign_recipients"]
SA["sms_audit_log"]
end
C --> S
S --> T
S --> |Direct FCM send| T
PW --> O
PW --> T
PW --> A
SW --> SC
SW --> SR
SW --> SA
```

**Diagram sources**
- [notifications.controller.ts:1-60](file://apps/api/src/modules/notifications/notifications.controller.ts#L1-L60)
- [notifications.service.ts:1-229](file://apps/api/src/modules/notifications/notifications.service.ts#L1-L229)
- [index.ts:1-127](file://supabase/functions/notification-worker/index.ts#L1-L127)
- [index.ts:1-306](file://supabase/functions/sms-campaign-worker/index.ts#L1-L306)
- [20260713090000_notification_delivery_pipeline.sql:1-94](file://supabase/migrations/20260713090000_notification_delivery_pipeline.sql#L1-L94)
- [20260728120000_sms_marketing.sql:1-259](file://supabase/migrations/20260728120000_sms_marketing.sql#L1-L259)

**Section sources**
- [notifications.controller.ts:1-60](file://apps/api/src/modules/notifications/notifications.controller.ts#L1-L60)
- [notifications.service.ts:1-229](file://apps/api/src/modules/notifications/notifications.service.ts#L1-L229)
- [index.ts:1-127](file://supabase/functions/notification-worker/index.ts#L1-L127)
- [index.ts:1-306](file://supabase/functions/sms-campaign-worker/index.ts#L1-L306)
- [20260713090000_notification_delivery_pipeline.sql:1-94](file://supabase/migrations/20260713090000_notification_delivery_pipeline.sql#L1-L94)
- [20260728120000_sms_marketing.sql:1-259](file://supabase/migrations/20260728120000_sms_marketing.sql#L1-L259)

## Core Components
- Push Outbox Worker: claims queued or retrying outbox rows, respects user preferences, sends via Expo Push, records per-token delivery attempts, and reconciles receipts to mark delivered or failed.
- SMS Campaign Worker: processes one batch per invocation, validates admin privileges, normalizes phone numbers, sends via Twilio (with no-op mode when credentials are missing), updates recipient statuses, and logs audit events.
- API Notifications Service: manages device tokens, sends single or multicast push messages via Firebase Admin SDK, and provides broadcast helpers targeting drivers or specific users.
- API Notifications Controller: exposes endpoints for token registration, history retrieval, and admin broadcasts.

Key capabilities:
- Templates: message templates stored in campaign definitions; push payloads include title, body, optional image URL, and data fields.
- Scheduling: outbox uses next_attempt_at and locked_until for retry scheduling; SMS campaigns use batch_index and rate_limit_secs enforced by caller.
- Broadcast: targeted broadcasts to all drivers, online drivers, or specific users.
- Delivery status: per-attempt records and campaign counters provide visibility into success/failure.

**Section sources**
- [index.ts:1-127](file://supabase/functions/notification-worker/index.ts#L1-L127)
- [index.ts:1-306](file://supabase/functions/sms-campaign-worker/index.ts#L1-L306)
- [notifications.service.ts:1-229](file://apps/api/src/modules/notifications/notifications.service.ts#L1-L229)
- [notifications.controller.ts:1-60](file://apps/api/src/modules/notifications/notifications.controller.ts#L1-L60)
- [broadcast.dto.ts:1-53](file://apps/api/src/modules/notifications/dto/broadcast.dto.ts#L1-L53)
- [20260713090000_notification_delivery_pipeline.sql:1-94](file://supabase/migrations/20260713090000_notification_delivery_pipeline.sql#L1-L94)
- [20260728120000_sms_marketing.sql:1-259](file://supabase/migrations/20260728120000_sms_marketing.sql#L1-L259)

## Architecture Overview
The system separates concerns between API-triggered actions and background processing:
- Direct push via API using Firebase Admin SDK for immediate delivery
- Durable push delivery via Supabase Edge Function reading from an outbox table with retry and receipt reconciliation
- SMS marketing via a batched worker that processes recipients in controlled batches

```mermaid
sequenceDiagram
participant Admin as "Admin UI"
participant API as "NotificationsController"
participant SVC as "NotificationsService"
participant DB as "Database"
participant FW as "Firebase Cloud Messaging"
Admin->>API : POST /notifications/broadcast
API->>SVC : broadcastToOnlineDrivers(...)
SVC->>DB : select active tokens
SVC->>FW : sendEachForMulticast(tokens)
FW-->>SVC : responses (success/fail)
SVC->>DB : log results and deactivate invalid tokens
SVC-->>API : {sent, failed}
API-->>Admin : result
```

**Diagram sources**
- [notifications.controller.ts:27-50](file://apps/api/src/modules/notifications/notifications.controller.ts#L27-L50)
- [notifications.service.ts:136-211](file://apps/api/src/modules/notifications/notifications.service.ts#L136-L211)

```mermaid
sequenceDiagram
participant Caller as "Scheduler/Admin"
participant PW as "Push Worker"
participant DB as "Database"
participant EXPO as "Expo Push"
Caller->>PW : POST (secret-authenticated)
PW->>DB : claim_notification_outbox(limit)
DB-->>PW : outbox jobs
loop For each job
PW->>DB : read profile preferences + tokens
PW->>EXPO : send push to tokens
EXPO-->>PW : tickets
PW->>DB : insert delivery attempts
PW->>DB : update outbox status (sent/retry/failed)
end
PW->>DB : query accepted tickets older than threshold
PW->>EXPO : getReceipts(ids)
EXPO-->>PW : receipts
PW->>DB : update attempts to delivered/failed
```

**Diagram sources**
- [index.ts:1-127](file://supabase/functions/notification-worker/index.ts#L1-L127)
- [20260713090000_notification_delivery_pipeline.sql:50-76](file://supabase/migrations/20260713090000_notification_delivery_pipeline.sql#L50-L76)

```mermaid
sequenceDiagram
participant Admin as "Admin UI"
participant SW as "SMS Campaign Worker"
participant DB as "Database"
participant TW as "Twilio"
Admin->>SW : POST {campaign_id, batch_index}
SW->>DB : validate campaign + load batch recipients
SW->>TW : send SMS (per recipient)
TW-->>SW : response
SW->>DB : update recipient status (sent/failed)
SW->>DB : update campaign counters and status
SW-->>Admin : batch results
```

**Diagram sources**
- [index.ts:140-306](file://supabase/functions/sms-campaign-worker/index.ts#L140-L306)
- [20260728120000_sms_marketing.sql:51-131](file://supabase/migrations/20260728120000_sms_marketing.sql#L51-L131)

## Detailed Component Analysis

### Push Outbox Worker
Responsibilities:
- Authenticate via secret header
- Claim up to a fixed batch size of outbox rows
- Respect recipient preferences and active device tokens
- Send pushes via Expo, record per-token attempts, and reconcile receipts
- Update outbox status to sent, retrying, failed, or skipped based on outcomes

Retry and rate behavior:
- Exponential backoff computed from attempt count
- Max attempts capped before marking failed
- Receipt reconciliation marks delivered or failed and invalidates unregistered devices

```mermaid
flowchart TD
Start(["Worker invoked"]) --> Auth["Validate secret"]
Auth --> Claim["Claim outbox rows"]
Claim --> Loop{"Jobs available?"}
Loop --> |No| End(["Return counts"])
Loop --> |Yes| Pref["Check preferences + tokens"]
Pref --> Send["Send to Expo"]
Send --> Record["Insert delivery attempts"]
Record --> Update["Update outbox status"]
Update --> Receipts["Query accepted tickets"]
Receipts --> Reconcile["Get receipts and update attempts"]
Reconcile --> Loop
```

**Diagram sources**
- [index.ts:1-127](file://supabase/functions/notification-worker/index.ts#L1-L127)

**Section sources**
- [index.ts:1-127](file://supabase/functions/notification-worker/index.ts#L1-L127)
- [20260713090000_notification_delivery_pipeline.sql:11-45](file://supabase/migrations/20260713090000_notification_delivery_pipeline.sql#L11-L45)

### SMS Campaign Worker
Responsibilities:
- Validate admin JWT and role
- Load campaign and ensure processable state
- Fetch a batch of pending recipients by batch_index
- Normalize phone numbers and send SMS via Twilio
- Update recipient statuses and campaign counters
- Append audit log entries for batch lifecycle

Rate limiting and fallback:
- Rate limit is enforced by caller between batch calls using campaign.rate_limit_secs
- No-op mode when provider credentials are absent (useful for staging)

```mermaid
flowchart TD
Start(["Batch call"]) --> Auth["Validate JWT + role"]
Auth --> Load["Load campaign + recipients"]
Load --> SendLoop{"Recipients"}
SendLoop --> |Next| Normalize["Normalize phone"]
Normalize --> Send["Send SMS"]
Send --> Status["Update recipient status"]
Status --> SendLoop
SendLoop --> |Done| Counters["Update campaign counters"]
Counters --> Audit["Append audit log"]
Audit --> End(["Return batch results"])
```

**Diagram sources**
- [index.ts:140-306](file://supabase/functions/sms-campaign-worker/index.ts#L140-L306)

**Section sources**
- [index.ts:1-306](file://supabase/functions/sms-campaign-worker/index.ts#L1-L306)
- [20260728120000_sms_marketing.sql:51-131](file://supabase/migrations/20260728120000_sms_marketing.sql#L51-L131)

### API Notifications Service and Controller
Responsibilities:
- Register and manage device tokens with deactivation of stale tokens
- Send single or multicast push messages via Firebase Admin SDK
- Provide broadcast endpoints for drivers and specific users
- Log delivery outcomes and deactivate invalid tokens automatically

Broadcast targets:
- All approved/active drivers
- Online drivers
- Specific user IDs

```mermaid
classDiagram
class NotificationsController {
+registerToken()
+getHistory()
+broadcast()
+getAdminHistory()
}
class NotificationsService {
+registerToken(userId, token, platform, deviceId, deviceName)
+sendToUser(userId, payload)
+sendToToken(token, payload)
+broadcastToAll(payload)
+broadcastToOnlineDrivers(payload)
+broadcastToDriversByStatus(status, payload)
+broadcastToMultipleUsers(userIds, payload)
+getNotificationHistory(userId, limit)
}
NotificationsController --> NotificationsService : "delegates"
```

**Diagram sources**
- [notifications.controller.ts:1-60](file://apps/api/src/modules/notifications/notifications.controller.ts#L1-L60)
- [notifications.service.ts:1-229](file://apps/api/src/modules/notifications/notifications.service.ts#L1-L229)

**Section sources**
- [notifications.controller.ts:1-60](file://apps/api/src/modules/notifications/notifications.controller.ts#L1-L60)
- [notifications.service.ts:1-229](file://apps/api/src/modules/notifications/notifications.service.ts#L1-L229)
- [broadcast.dto.ts:1-53](file://apps/api/src/modules/notifications/dto/broadcast.dto.ts#L1-L53)

### Data Models and Schema
Key tables and relationships:
- notification_tokens: stores device tokens with validity and last push timestamps
- notification_outbox: durable queue for push delivery with idempotency keys and retry scheduling
- notification_delivery_attempts: per-token delivery outcomes and provider responses
- sms_campaigns: campaign metadata, batch size, counters, and rate limits
- sms_campaign_recipients: per-user campaign rows with status and timestamps
- sms_audit_log: append-only audit trail for campaign events

```mermaid
erDiagram
NOTIFICATION_TOKENS {
uuid id PK
uuid user_id FK
text token
text platform
timestamptz invalidated_at
text invalid_reason
timestamptz last_push_at
}
NOTIFICATION_OUTBOX {
uuid id PK
uuid notification_id FK
uuid recipient_id FK
text event_type
text category
text title
text body
jsonb payload
text idempotency_key
text status
int attempts
timestamptz next_attempt_at
timestamptz locked_until
text last_error
timestamptz completed_at
timestamptz created_at
timestamptz updated_at
}
NOTIFICATION_DELIVERY_ATTEMPTS {
uuid id PK
uuid outbox_id FK
uuid token_id FK
text expo_ticket_id
text status
jsonb provider_response
text error_code
text error_message
timestamptz receipt_checked_at
timestamptz created_at
timestamptz updated_at
}
SMS_CAMPAIGNS {
uuid id PK
text name
text message_template
int batch_size
int total_recipients
int sent_count
int failed_count
text status
int rate_limit_secs
uuid created_by
timestamptz queued_at
timestamptz started_at
timestamptz completed_at
timestamptz created_at
timestamptz updated_at
}
SMS_CAMPAIGN_RECIPIENTS {
uuid id PK
uuid campaign_id FK
uuid user_id FK
text phone
text full_name
int batch_index
text status
timestamptz sent_at
timestamptz failed_at
text error_message
timestamptz created_at
}
SMS_AUDIT_LOG {
uuid id PK
uuid campaign_id FK
text event
uuid actor_id FK
int batch_index
jsonb detail
timestamptz created_at
}
NOTIFICATION_OUTBOX ||--o{ NOTIFICATION_DELIVERY_ATTEMPTS : "has many"
SMS_CAMPAIGNS ||--o{ SMS_CAMPAIGN_RECIPIENTS : "has many"
```

**Diagram sources**
- [20260713090000_notification_delivery_pipeline.sql:5-45](file://supabase/migrations/20260713090000_notification_delivery_pipeline.sql#L5-L45)
- [20260728120000_sms_marketing.sql:51-131](file://supabase/migrations/20260728120000_sms_marketing.sql#L51-L131)

**Section sources**
- [20260713090000_notification_delivery_pipeline.sql:1-94](file://supabase/migrations/20260713090000_notification_delivery_pipeline.sql#L1-L94)
- [20260728120000_sms_marketing.sql:1-259](file://supabase/migrations/20260728120000_sms_marketing.sql#L1-L259)

## Dependency Analysis
- API depends on Prisma-managed database for token storage and logs
- Push worker depends on Supabase RPC to claim outbox rows and writes to delivery attempts
- SMS worker depends on campaign and recipient tables plus audit log
- External integrations:
  - Firebase Cloud Messaging via Admin SDK for direct push
  - Expo Push for outbox-based push delivery
  - Twilio for SMS delivery

Potential coupling points:
- Token lifecycle managed by API; worker reads tokens to deliver
- Outbox relies on idempotency keys to prevent duplicates
- SMS campaign state machine driven by worker updates

**Section sources**
- [notifications.service.ts:1-229](file://apps/api/src/modules/notifications/notifications.service.ts#L1-L229)
- [index.ts:1-127](file://supabase/functions/notification-worker/index.ts#L1-L127)
- [index.ts:1-306](file://supabase/functions/sms-campaign-worker/index.ts#L1-L306)

## Performance Considerations
- Batch sizes:
  - Push worker claims up to a fixed batch size per invocation
  - SMS campaigns enforce batch sizes at creation time
- Multicast messaging:
  - API chunks tokens into batches for efficient multicast sends
- Retry strategy:
  - Exponential backoff for push outbox with max attempts
  - SMS failures recorded per recipient for later retry workflows
- Receipt reconciliation:
  - Periodic polling of Expo receipts to mark delivered or failed
- Indexes:
  - Optimized indexes on outbox claim queries and campaign recipient lookups

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and diagnostics:
- Push not received:
  - Check recipient preferences and active tokens
  - Review delivery attempts for provider errors and receipt status
  - Invalidate tokens marked as DeviceNotRegistered
- SMS campaign stalls:
  - Verify campaign status and batch_index progression
  - Ensure caller respects rate_limit_secs between batches
  - Inspect sms_audit_log for batch_started/batch_completed events
- Invalid tokens:
  - API deactivates tokens on registration errors
  - Worker invalidates tokens on provider feedback

Operational checks:
- Confirm environment variables for providers (Firebase, Expo, Twilio)
- Validate secret headers for push worker authentication
- Ensure service-role access for worker database operations

**Section sources**
- [index.ts:1-127](file://supabase/functions/notification-worker/index.ts#L1-L127)
- [index.ts:1-306](file://supabase/functions/sms-campaign-worker/index.ts#L1-L306)
- [notifications.service.ts:100-132](file://apps/api/src/modules/notifications/notifications.service.ts#L100-L132)

## Conclusion
The notification system combines immediate push delivery via the API with a robust, durable outbox pipeline for reliable push distribution and a scalable SMS campaign engine. Together, they provide:
- Template-driven messaging
- Configurable scheduling and batching
- Comprehensive delivery status and analytics
- Resilient retries and provider-specific fallbacks
- Clear separation of responsibilities across API, workers, and database

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Examples and Usage Patterns
- Sending push notifications:
  - Use the broadcast endpoint to target drivers or specific users
  - Reference token registration and history endpoints for device management
- Managing SMS campaigns:
  - Create a campaign with a template and batch size
  - Select recipients and queue the campaign
  - Invoke the worker repeatedly with increasing batch_index values, respecting rate limits
- Handling delivery status:
  - Query delivery attempts for push outcomes
  - Review campaign counters and audit logs for SMS progress

**Section sources**
- [notifications.controller.ts:11-58](file://apps/api/src/modules/notifications/notifications.controller.ts#L11-L58)
- [notifications.service.ts:104-162](file://apps/api/src/modules/notifications/notifications.service.ts#L104-L162)
- [index.ts:175-306](file://supabase/functions/sms-campaign-worker/index.ts#L175-L306)