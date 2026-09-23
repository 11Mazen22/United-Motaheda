/**
 * Template Compiler Service
 * 
 * Fetches templates from the database, determines language based on user locale,
 * and compiles variables ({{user_name}}, {{order_number}}, etc.).
 * 
 * Supports:
 * - Multi-language templates (Arabic/English with fallback)
 * - Handlebars-style variable interpolation
 * - Template caching for performance
 * - Validation of required variables
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';

export interface TemplateData {
  [key: string]: string | number | boolean | null | undefined;
}

export interface CompiledTemplate {
  title: string;
  body: string;
  locale: string;
  type: string;
}

export interface TemplateOptions {
  locale?: string;
  fallbackLocale?: string;
  cacheTTL?: number; // in seconds
}

@Injectable()
export class TemplateCompilerService implements OnModuleInit {
  private readonly logger = new Logger(TemplateCompilerService.name);
  private supabase: SupabaseClient;
  private templateCache: Map<string, { template: any; expiresAt: number }> = new Map();
  private readonly DEFAULT_LOCALE = 'ar';
  private readonly FALLBACK_LOCALE = 'en';
  private readonly CACHE_TTL = 300; // 5 minutes default
  private readonly DB_TIMEOUT_MS = 8_000;

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  onModuleInit() {
    this.logger.log('Template Compiler Service initialized');
    // Preload is disabled: notification_templates (the real, live table -
    // confirmed via direct schema query) has no `locale`, `subject_template`,
    // `body_template`, or `data_schema` columns at all -- it stores one row
    // per type with title_ar/body_ar/title_en/body_en inline, not the
    // locale-keyed multi-row design this whole service was written against.
    // Every preload attempt was throwing "column notification_templates.locale
    // does not exist" on every single deploy (confirmed live in Railway
    // deploy logs). This service has no live callers today - BatchProcessor
    // (the one real consumer of the notification hub, for admin broadcasts)
    // never calls compileTemplate()/loadTemplate() - so silencing the
    // preload changes no observed behavior, just stops the startup noise.
    // Reconciling the compiler with the real schema (read title_ar/title_en
    // from one row instead of a locale-keyed row) is a real but separate
    // piece of work, not attempted here.
  }

  /**
   * Preload most commonly used templates into cache
   */
  private async preloadTemplates(): Promise<void> {
    const commonTypes = [
      'order.ready',
      'order.out_for_delivery',
      'order.delivered',
      'payment.success',
    ];

    for (const type of commonTypes) {
      try {
        await this.loadTemplate(type);
      } catch (error) {
        this.logger.warn(`Failed to preload template: ${type}`);
      }
    }
  }

  /**
   * Load a template from the database (with caching)
   */
  private async loadTemplate(
    type: string,
    locale?: string
  ): Promise<any | null> {
    const cacheKey = `${type}:${locale || this.DEFAULT_LOCALE}`;
    
    // Check cache
    const cached = this.templateCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.template;
    }

    try {
      const query = this.supabase
        .from('notification_templates')
        .select('*')
        .eq('type', type)
        .eq('is_active', true);

      if (locale) {
        query.eq('locale', locale);
      }

      const { data, error } = await query.abortSignal(
        AbortSignal.timeout(this.DB_TIMEOUT_MS),
      );

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        // Try fallback locale
        if (locale && locale !== this.FALLBACK_LOCALE) {
          this.logger.warn(`Template ${type} not found in ${locale}, trying fallback`);
          return this.loadTemplate(type, this.FALLBACK_LOCALE);
        }
        // Try default locale
        if (locale !== this.DEFAULT_LOCALE) {
          return this.loadTemplate(type, this.DEFAULT_LOCALE);
        }
        this.logger.error(`Template ${type} not found`);
        return null;
      }

      const template = data[0];

      // Cache with expiration
      this.templateCache.set(cacheKey, {
        template,
        expiresAt: Date.now() + (this.CACHE_TTL * 1000),
      });

      return template;
    } catch (error) {
      this.logger.error(`Error loading template ${type}: ${error.message}`);
      return null;
    }
  }

  /**
   * Compile a template with the given data
   */
  async compileTemplate(
    type: string,
    data: TemplateData,
    options: TemplateOptions = {}
  ): Promise<CompiledTemplate | null> {
    const locale = options.locale || this.DEFAULT_LOCALE;
    const fallbackLocale = options.fallbackLocale || this.FALLBACK_LOCALE;

    // Try to load template in requested locale
    let template = await this.loadTemplate(type, locale);

    // If not found, try fallback
    if (!template && fallbackLocale !== locale) {
      template = await this.loadTemplate(type, fallbackLocale);
    }

    // If still not found, try default
    if (!template && locale !== this.DEFAULT_LOCALE) {
      template = await this.loadTemplate(type, this.DEFAULT_LOCALE);
    }

    if (!template) {
      this.logger.error(`Template not found for type: ${type}`);
      return null;
    }

    // Validate required data
    const schema = template.data_schema || {};
    const requiredFields = Object.entries(schema)
      .filter(([, def]: [string, any]) => def.required)
      .map(([key]) => key);

    const missingFields = requiredFields.filter(field => data[field] === undefined);
    if (missingFields.length > 0) {
      this.logger.error(
        `Missing required fields for template ${type}: ${missingFields.join(', ')}`
      );
      // Don't fail, use placeholder instead
    }

    // Compile title and body
    const compiledTitle = this.interpolate(template.subject_template || '', data);
    const compiledBody = this.interpolate(template.body_template, data);

    return {
      title: compiledTitle,
      body: compiledBody,
      locale: template.locale,
      type: type,
    };
  }

  /**
   * Interpolate template variables using Handlebars-style syntax
   * {{variable_name}} or {{variable_name|default}}
   */
  private interpolate(text: string, data: TemplateData): string {
    if (!text) return '';
    if (!data || Object.keys(data).length === 0) return text;

    return text.replace(/\{\{([^}]+)\}\}/g, (match, expression) => {
      const trimmed = expression.trim();
      
      // Handle default values: {{variable|default}}
      const parts = trimmed.split('|');
      const key = parts[0].trim();
      const defaultValue = parts[1]?.trim() || '';

      // Handle nested objects: {{user.name}}
      let value: any = data;
      for (const segment of key.split('.')) {
        if (value && typeof value === 'object' && segment in value) {
          value = value[segment];
        } else {
          value = undefined;
          break;
        }
      }

      // Handle functions: {{formatDate(timestamp)}}
      if (value === undefined && key.includes('(')) {
        return this.handleFunction(key, data);
      }

      if (value !== undefined && value !== null) {
        return String(value);
      }

      return defaultValue || match;
    });
  }

  /**
   * Handle function calls in templates
   * Example: {{formatDate(createdAt)}}
   */
  private handleFunction(expression: string, data: TemplateData): string {
    const match = expression.match(/^(\w+)\(([^)]*)\)$/);
    if (!match) return expression;

    const [, funcName, arg] = match;
    const argValue = this.interpolate(`{{${arg.trim()}}}`, data);
    
    switch (funcName) {
      case 'formatDate':
        return this.formatDate(argValue);
      case 'formatCurrency':
        return this.formatCurrency(argValue);
      case 'truncate':
        return this.truncateText(argValue);
      default:
        return expression;
    }
  }

  /**
   * Format a date string
   */
  private formatDate(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  }

  /**
   * Format a currency amount
   */
  private formatCurrency(amount: string): string {
    try {
      const num = parseFloat(amount);
      if (isNaN(num)) return amount;
      return new Intl.NumberFormat('ar-EG', {
        style: 'currency',
        currency: 'EGP',
      }).format(num);
    } catch {
      return amount;
    }
  }

  /**
   * Truncate text to a specified length
   */
  private truncateText(text: string): string {
    try {
      const [str, length = '50'] = text.split(',');
      if (!str) return '';
      const maxLen = parseInt(length.trim());
      if (isNaN(maxLen)) return str;
      return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
    } catch {
      return text;
    }
  }

  /**
   * Clear the template cache
   */
  clearCache(): void {
    this.templateCache.clear();
    this.logger.log('Template cache cleared');
  }

  /**
   * Preload a specific template into cache
   */
  async preloadTemplate(type: string, locale?: string): Promise<void> {
    await this.loadTemplate(type, locale);
  }

  /**
   * Get all available templates
   */
  async getAllTemplates(): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('notification_templates')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;
      return data || [];
    } catch (error) {
      this.logger.error(`Error fetching templates: ${error.message}`);
      return [];
    }
  }

  /**
   * Get templates by type and locale
   */
  async getTemplatesByType(type: string): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('notification_templates')
        .select('*')
        .eq('type', type)
        .eq('is_active', true)
        .order('locale');

      if (error) throw error;
      return data || [];
    } catch (error) {
      this.logger.error(`Error fetching templates for ${type}: ${error.message}`);
      return [];
    }
  }

  /**
   * Preview template compilation (without saving)
   */
  async previewTemplate(
    type: string,
    data: TemplateData,
    locale: string = this.DEFAULT_LOCALE
  ): Promise<string> {
    const compiled = await this.compileTemplate(type, data, { locale });
    return compiled?.body || 'Template not found';
  }

  /**
   * Bulk compile templates for multiple recipients
   */
  async bulkCompile(
    type: string,
    dataArray: TemplateData[],
    options: TemplateOptions = {}
  ): Promise<CompiledTemplate[]> {
    const results: CompiledTemplate[] = [];
    
    for (const data of dataArray) {
      const compiled = await this.compileTemplate(type, data, options);
      if (compiled) {
        results.push(compiled);
      }
    }
    
    return results;
  }
}
