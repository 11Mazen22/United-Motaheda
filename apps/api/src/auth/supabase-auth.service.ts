import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { PrismaService } from '../prisma/prisma.service';

export interface AuthenticatedUser {
  userId: string;
  authUser: User;
  profile: any;
}

@Injectable()
export class SupabaseAuthService {
  private readonly supabase: SupabaseClient;

  constructor(private readonly prisma: PrismaService) {
    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
    }
    this.supabase = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  async signIn(identifier: string, password: string) {
    const email = await this.resolveEmail(identifier);
    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session || !data.user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return data;
  }

  async createUser(input: { email: string; password: string; phone?: string; fullName: string }) {
    const { data, error } = await this.supabase.auth.admin.createUser({
      email: input.email,
      password: input.password,
      phone: input.phone,
      email_confirm: true,
      user_metadata: { full_name: input.fullName, name: input.fullName, phone: input.phone },
    });
    if (error || !data.user) {
      throw error ?? new Error('Unable to create authentication user');
    }
    return data.user;
  }

  async authenticateAccessToken(token: string): Promise<AuthenticatedUser> {
    const { data, error } = await this.supabase.auth.getUser(token);
    if (error || !data.user) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const profile = await this.prisma.profiles.findUnique({
      where: { id: data.user.id },
      include: { driverProfile: true },
    });
    if (!profile) {
      throw new UnauthorizedException('Profile not found');
    }

    return { userId: data.user.id, authUser: data.user, profile };
  }

  async getProfile(userId: string) {
    return this.prisma.profiles.findUnique({ where: { id: userId } });
  }

  private async resolveEmail(identifier: string) {
    if (identifier.includes('@')) return identifier;

    const profile = await this.prisma.profiles.findFirst({
      where: { phone: identifier },
      select: { email: true },
    });
    if (!profile?.email) throw new UnauthorizedException('Invalid credentials');
    return profile.email;
  }
}