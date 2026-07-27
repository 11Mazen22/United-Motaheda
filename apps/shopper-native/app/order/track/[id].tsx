/**
 * Route: /order/track/[id]?token=<qr_token>
 *
 * Expo Router entry point for the customer live tracking screen.
 *
 * Navigation:
 *   Pushed from app/order/[id].tsx when the order is in a trackable status
 *   (out_for_delivery, picked_up, shipped) and qrToken is available.
 *
 *   Example push:
 *     router.push(`/order/track/${order.id}?token=${order.qrToken}`)
 *
 * The `token` search param carries orders.qr_token which is required by
 * the track-order Edge Function as the bearer capability. It is read by
 * TrackOrderScreen via useLocalSearchParams<{ id, token }>().
 */

export { TrackOrderScreen as default } from "@/features/orders/screens/TrackOrderScreen";
