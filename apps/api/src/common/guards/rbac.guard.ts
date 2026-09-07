/**
 * Role-Based Access Control (RBAC) Guard
 * 
 * Enforces strictly enforced Role-Based Access Control so only:
 * - Super Admins can configure templates
 * - Branch Managers can only send to their own branch
 * - Admins can view metrics and send blasts
 * 
 * Updated with notification-specific permissions.
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';

export type UserRole = 'super_admin' | 'admin' | 'manager' | 'pharmacist' | 'driver' | 'customer';

export interface Permission {
  resource: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'manage';
}

// ============================================================
// Permission Definitions
// ============================================================

export const PERMISSIONS: Record<UserRole, Permission[]> = {
  super_admin: [
    { resource: 'all', action: 'manage' },
    // Notification permissions
    { resource: 'notifications', action: 'manage' },
    { resource: 'templates', action: 'manage' },
    { resource: 'batches', action: 'manage' },
    { resource: 'metrics', action: 'read' },
  ],
  admin: [
    { resource: 'notifications', action: 'create' },
    { resource: 'notifications', action: 'read' },
    { resource: 'batches', action: 'create' },
    { resource: 'batches', action: 'read' },
    { resource: 'metrics', action: 'read' },
    { resource: 'templates', action: 'read' },
  ],
  manager: [
    { resource: 'notifications', action: 'create' },
    { resource: 'notifications', action: 'read' },
    { resource: 'batches', action: 'read' },
    { resource: 'metrics', action: 'read' },
  ],
  pharmacist: [
    { resource: 'notifications', action: 'read' },
  ],
  driver: [
    { resource: 'notifications', action: 'read' },
  ],
  customer: [
    { resource: 'notifications', action: 'read' },
  ],
};

// ============================================================
// Roles Decorator
// ============================================================

export const ROLES_KEY = 'roles';
export const PERMISSIONS_KEY = 'permissions';

// ============================================================
// RBAC Guard
// ============================================================

@Injectable()
export class RbacGuard implements CanActivate {
  private readonly logger = new Logger(RbacGuard.name);
  private supabase: SupabaseClient;

  constructor(
    private reflector: Reflector,
    private configService: ConfigService,
  ) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      this.logger.warn('No user found in request');
      throw new ForbiddenException('Authentication required');
    }

    // Get user role from database
    const userRole = await this.getUserRole(user.id);
    
    if (!userRole) {
      this.logger.warn(`No role found for user: ${user.id}`);
      throw new ForbiddenException('User role not found');
    }

    // Get required roles from decorator
    const requiredRoles = this.reflector.get<string[]>(ROLES_KEY, context.getHandler()) || [];
    const requiredPermissions = this.reflector.get<Permission[]>(PERMISSIONS_KEY, context.getHandler()) || [];

    // Check if user has required role
    if (requiredRoles.length > 0) {
      const hasRole = requiredRoles.includes(userRole);
      if (!hasRole) {
        this.logger.warn(`User ${user.id} with role ${userRole} denied access. Required roles: ${requiredRoles.join(', ')}`);
        throw new ForbiddenException(`Insufficient role. Required: ${requiredRoles.join(', ')}`);
      }
    }

    // Check if user has required permission
    if (requiredPermissions.length > 0) {
      const userPermissions = PERMISSIONS[userRole as UserRole] || [];
      
      // Check for manage permission (wildcard)
      const hasManageAll = userPermissions.some(p => p.resource === 'all' && p.action === 'manage');
      
      if (hasManageAll) {
        // Super admin can do anything
        return true;
      }

      // Check specific permissions
      const hasPermission = requiredPermissions.every((required) => {
        // Check if user has this specific permission
        return userPermissions.some((p) => {
          // Exact match
          if (p.resource === required.resource && p.action === required.action) {
            return true;
          }
          // Manage on resource gives all actions
          if (p.resource === required.resource && p.action === 'manage') {
            return true;
          }
          return false;
        });
      });

      if (!hasPermission) {
        const requiredStr = requiredPermissions.map(p => `${p.action}:${p.resource}`).join(', ');
        this.logger.warn(`User ${user.id} with role ${userRole} denied access. Required permissions: ${requiredStr}`);
        throw new ForbiddenException(`Insufficient permissions. Required: ${requiredStr}`);
      }
    }

    // 🆕 Check branch-specific access for managers
    if (userRole === 'manager') {
      const requestBody = request.body;
      const branchId = requestBody?.branchId || requestBody?.targeting?.branchId || request.query?.branchId;

      if (branchId) {
        const userBranchId = await this.getUserBranch(user.id);
        if (userBranchId && userBranchId !== branchId) {
          this.logger.warn(`Manager ${user.id} attempted to access branch ${branchId} (their branch: ${userBranchId})`);
          throw new ForbiddenException('You can only access your own branch');
        }
      }
    }

    // 🆕 Check if user can access notification templates (only super_admin can modify)
    if (userRole !== 'super_admin') {
      const url = request.url;
      const method = request.method;
      
      // Block template modification for non-super admins
      if (url.includes('/templates') && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        this.logger.warn(`User ${user.id} with role ${userRole} attempted to modify templates`);
        throw new ForbiddenException('Only Super Admins can modify templates');
      }
    }

    return true;
  }

  /**
   * Get user role from database
   */
  private async getUserRole(userId: string): Promise<string | null> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .single();

      if (error) {
        this.logger.error(`Failed to get user role: ${error.message}`);
        return null;
      }

      return data?.role || null;
    } catch (error) {
      this.logger.error(`Error getting user role: ${error.message}`);
      return null;
    }
  }

  /**
   * Get user's branch ID
   */
  private async getUserBranch(userId: string): Promise<string | null> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('branch_id')
        .eq('id', userId)
        .single();

      if (error) {
        this.logger.error(`Failed to get user branch: ${error.message}`);
        return null;
      }

      return data?.branch_id || null;
    } catch (error) {
      this.logger.error(`Error getting user branch: ${error.message}`);
      return null;
    }
  }

  /**
   * Check if user has a specific permission
   */
  async hasPermission(userId: string, resource: string, action: string): Promise<boolean> {
    const role = await this.getUserRole(userId);
    if (!role) return false;

    const permissions = PERMISSIONS[role as UserRole] || [];
    
    // Check for manage all
    if (permissions.some(p => p.resource === 'all' && p.action === 'manage')) {
      return true;
    }

    // Check specific permission
    return permissions.some(p => 
      (p.resource === resource && p.action === action) ||
      (p.resource === resource && p.action === 'manage')
    );
  }

  /**
   * Get all permissions for a role
   */
  getPermissionsForRole(role: UserRole): Permission[] {
    return PERMISSIONS[role] || [];
  }

  /**
   * Check if a role has a specific permission
   */
  roleHasPermission(role: UserRole, resource: string, action: string): boolean {
    const permissions = PERMISSIONS[role] || [];
    
    return permissions.some(p => 
      (p.resource === resource && p.action === action) ||
      (p.resource === resource && p.action === 'manage') ||
      (p.resource === 'all' && p.action === 'manage')
    );
  }
}

// ============================================================
// Decorators for easier usage
// ============================================================

import { SetMetadata } from '@nestjs/common';

/**
 * Require specific roles
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Require specific permissions
 */
export const Permissions = (...permissions: Permission[]) => SetMetadata(PERMISSIONS_KEY, permissions);

/**
 * Shortcut for notification management permissions
 */
export const ManageNotifications = () => 
  Permissions(
    { resource: 'notifications', action: 'manage' },
    { resource: 'batches', action: 'manage' },
  );

/**
 * Shortcut for viewing metrics
 */
export const ViewMetrics = () => 
  Permissions({ resource: 'metrics', action: 'read' });

/**
 * Shortcut for template management (Super Admin only)
 */
export const ManageTemplates = () => 
  Roles('super_admin');