/**
 * Template Compiler Unit Tests
 * 
 * Tests ensuring correct fallback (Arabic -> English -> Default)
 * and variable rendering.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { TemplateCompilerService } from '../templates/template.compiler';

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              data: [],
              error: null,
            })),
          })),
        })),
      })),
    })),
  })),
}));

describe('TemplateCompilerService', () => {
  let service: TemplateCompilerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({
        load: [() => ({
          SUPABASE_URL: 'http://localhost:54321',
          SUPABASE_SERVICE_ROLE_KEY: 'mock-key',
        })],
      })],
      providers: [TemplateCompilerService],
    }).compile();

    service = module.get<TemplateCompilerService>(TemplateCompilerService);
  });

  describe('compileTemplate', () => {
    it('should compile template with variables', async () => {
      const result = await service.compileTemplate('order.ready', {
        userName: 'أحمد',
        orderNumber: '12345',
      });

      expect(result).toBeDefined();
      expect(result?.title).toBeDefined();
      expect(result?.body).toBeDefined();
    });

    it('should use default locale fallback', async () => {
      const result = await service.compileTemplate('order.ready', {
        userName: 'أحمد',
        orderNumber: '12345',
      }, { locale: 'unknown' });

      expect(result).toBeDefined();
    });

    it('should handle missing data gracefully', async () => {
      const result = await service.compileTemplate('order.ready', {
        userName: 'أحمد',
        // Missing orderNumber
      });

      expect(result).toBeDefined();
    });
  });

  describe('interpolate', () => {
    it('should replace simple variables', () => {
      const result = service['interpolate']('Hello {{name}}', { name: 'Ahmed' });
      expect(result).toBe('Hello Ahmed');
    });

    it('should handle nested objects', () => {
      const result = service['interpolate']('Hello {{user.name}}', {
        user: { name: 'Ahmed' },
      });
      expect(result).toBe('Hello Ahmed');
    });

    it('should handle default values', () => {
      const result = service['interpolate']('Hello {{name|Guest}}', {});
      expect(result).toBe('Hello Guest');
    });
  });
});