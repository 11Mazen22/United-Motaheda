import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  async listBranches() {
    return this.prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { nameEn: "asc" },
    });
  }

  async adminListBranches(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.branch.findMany({
        skip,
        take: limit,
        orderBy: { nameEn: 'asc' },
      }),
      this.prisma.branch.count(),
    ]);

    return {
      data: items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getBranch(id: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
      include: { zones: true },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }

  async createBranch(data: any) {
    return this.prisma.branch.create({
      data,
    });
  }

  async updateBranch(id: string, data: any) {
    return this.prisma.branch.update({
      where: { id },
      data,
    });
  }
}
