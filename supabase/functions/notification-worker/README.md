# Notification worker deployment

1. Apply the migration with `supabase db push`.
2. Deploy: `supabase functions deploy notification-worker --no-verify-jwt`.
3. Set `NOTIFICATION_WORKER_SECRET` to a high-entropy value using `supabase secrets set`.
4. Schedule an authenticated POST to this function at least once per minute. The scheduler must send `x-notification-worker-secret`; this secret must never be bundled into a client.
5. In the Expo/EAS project, configure Android FCM v1 credentials and the iOS APNs key for `com.unitedpharmacy.app`, then create new production builds. `google-services.json` is present in the app configuration, but the FCM/APNs credentials are verified in EAS/Supabase—not in source control.

The worker is deliberately the only component that contacts Expo's push API. It claims locked outbox jobs, honors recipient push preferences, records Expo tickets and receipts, retries transient failure with exponential backoff, and invalidates `DeviceNotRegistered` tokens.
