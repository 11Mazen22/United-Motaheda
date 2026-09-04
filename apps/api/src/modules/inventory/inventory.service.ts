import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.inventory.findMany({
        skip,
        take: limit,
        // No timestamp column on this table to order by — product_id at
        // least makes pagination deterministic instead of relying on
        // Postgres's unspecified default order, which can duplicate or
        // skip rows across pages under concurrent writes.
        orderBy: { product_id: 'asc' },
      }),
      this.prisma.inventory.count(),
    ]);

    return {
      data: items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
