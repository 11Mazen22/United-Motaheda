import { Body, Controller, Post } from "@nestjs/common";
import type { CreateOrderRequest } from "@pharmacy/contracts";
import { CreateOrderRequestSchema } from "@pharmacy/contracts";
import { OrdersService } from "./orders.service";

/**
 * LEGACY / UNUSED — as of 2026-07-06, no client in this monorepo calls this
 * route. shopper-web and shopper-native both create orders through the
 * Supabase `create-order` Edge Function instead (which authenticates the
 * caller and sets orders.user_id). This route has no auth guard and never
 * set user_id, and CreateOrderRequestSchema requires quoteToken/
 * assignmentToken/branchId that no known caller ever supplied — do not wire
 * a new client to this endpoint without adding auth + fixing that mismatch.
 */
@Controller("orders")
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  async create(@Body() body: unknown) {
    const input: CreateOrderRequest = CreateOrderRequestSchema.parse(body);
    return this.orders.create(input);
  }
}
