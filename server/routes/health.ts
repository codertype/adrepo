/**
 * Environment Health Check Endpoints
 * 
 * These endpoints verify that all critical environment variables are properly
 * configured and services are accessible on VPS deployment.
 */

import type { Express } from "express";
import { db } from "../db";
import { validateEnvironmentVariables, getEnvironmentSummary } from "../envValidation";
import { otpService } from "../services/otpService";
import nodemailer from 'nodemailer';
import crypto from 'crypto';

/**
 * Register health check routes
 */
export function registerHealthRoutes(app: Express): void {

  /**
   * GET /api/health/basic
   * Basic health check - always returns 200 if server is running
   */
  app.get('/api/health/basic', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      environment: process.env.NODE_ENV || 'development'
    });
  });

  /**
   * GET /api/health/environment  
   * Environment configuration health check
   */
  app.get('/api/health/environment', (req, res) => {
    try {
      const validation = validateEnvironmentVariables();
      const summary = getEnvironmentSummary();
      
      res.json({
        status: validation.isValid ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        configuration: summary,
        validation: {
          isValid: validation.isValid,
          errorCount: validation.errors.length,
          warningCount: validation.warnings.length,
          errors: validation.errors,
          warnings: validation.warnings
        }
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /api/health/database
   * Database connectivity health check
   */
  app.get('/api/health/database', async (req, res) => {
    try {
      // Test database connection with a simple query
      const startTime = Date.now();
      await db.raw('SELECT NOW() as current_time, version() as db_version');
      const responseTime = Date.now() - startTime;

      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'database',
        responseTime: `${responseTime}ms`,
        details: {
          connectionUrl: process.env.DATABASE_URL?.includes('neon.tech') ? 'neon.tech' : 'postgresql',
          ssl: process.env.DATABASE_URL?.includes('sslmode=require') ? 'required' : 'optional'
        }
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        service: 'database',
        error: error instanceof Error ? error.message : 'Database connection failed',
        details: {
          connectionUrl: process.env.DATABASE_URL ? 'configured' : 'missing',
          ssl: process.env.DATABASE_URL?.includes('sslmode=require') ? 'required' : 'optional'
        }
      });
    }
  });

  /**
   * GET /api/health/email
   * Email service (Gmail SMTP) health check
   */
  app.get('/api/health/email', async (req, res) => {
    try {
      const gmailUser = process.env.GMAIL_USER;
      const gmailPassword = process.env.GMAIL_APP_PASSWORD;

      if (!gmailUser || !gmailPassword) {
        return res.status(503).json({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          service: 'email',
          error: 'Gmail credentials not configured',
          details: {
            gmailUser: gmailUser ? 'configured' : 'missing',
            gmailPassword: gmailPassword ? 'configured' : 'missing'
          }
        });
      }

      // Create transporter and verify connection
      const transporter = nodemailer.createTransporter({
        service: 'gmail',
        auth: {
          user: gmailUser,
          pass: gmailPassword
        }
      });

      const startTime = Date.now();
      await transporter.verify();
      const responseTime = Date.now() - startTime;

      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'email',
        responseTime: `${responseTime}ms`,
        details: {
          provider: 'gmail',
          user: gmailUser,
          authenticated: true
        }
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        service: 'email',
        error: error instanceof Error ? error.message : 'SMTP connection failed',
        details: {
          provider: 'gmail',
          user: process.env.GMAIL_USER || 'not configured'
        }
      });
    }
  });

  /**
   * GET /api/health/payments
   * Payment gateway (Razorpay) health check
   */
  app.get('/api/health/payments', async (req, res) => {
    try {
      const keyId = process.env.RAZORPAY_KEY_ID;
      const keySecret = process.env.RAZORPAY_KEY_SECRET;

      if (!keyId || !keySecret) {
        return res.status(503).json({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          service: 'payments',
          error: 'Razorpay credentials not configured',
          details: {
            keyId: keyId ? 'configured' : 'missing',
            keySecret: keySecret ? 'configured' : 'missing'
          }
        });
      }

      // Validate key format
      const isTestKey = keyId.startsWith('rzp_test_');
      const isLiveKey = keyId.startsWith('rzp_live_');
      const isProduction = process.env.NODE_ENV === 'production';

      if (!isTestKey && !isLiveKey) {
        return res.status(503).json({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          service: 'payments',
          error: 'Invalid Razorpay key format',
          details: {
            keyId: keyId,
            expectedFormat: 'rzp_test_ or rzp_live_'
          }
        });
      }

      // Warning for key type mismatch
      let warning = null;
      if (isProduction && isTestKey) {
        warning = 'Using test key in production environment';
      } else if (!isProduction && isLiveKey) {
        warning = 'Using live key in development environment';
      }

      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'payments',
        details: {
          provider: 'razorpay',
          keyType: isTestKey ? 'test' : 'live',
          environment: isProduction ? 'production' : 'development',
          warning: warning
        }
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        service: 'payments',
        error: error instanceof Error ? error.message : 'Payment gateway check failed'
      });
    }
  });

  /**
   * GET /api/health/all
   * Comprehensive health check for all services
   */
  app.get('/api/health/all', async (req, res) => {
    const startTime = Date.now();
    const results = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      overallStatus: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
      services: {} as Record<string, any>,
      summary: {
        total: 0,
        healthy: 0,
        unhealthy: 0,
        warnings: 0
      }
    };

    // Test environment configuration
    try {
      const envValidation = validateEnvironmentVariables();
      results.services.environment = {
        status: envValidation.isValid ? 'healthy' : 'unhealthy',
        errors: envValidation.errors.length,
        warnings: envValidation.warnings.length
      };
      if (envValidation.warnings.length > 0) {
        results.summary.warnings++;
      }
    } catch (error) {
      results.services.environment = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Environment check failed'
      };
    }

    // Test database
    try {
      await db.raw('SELECT 1');
      results.services.database = { status: 'healthy' };
    } catch (error) {
      results.services.database = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Database connection failed'
      };
    }

    // Test email service
    try {
      const gmailUser = process.env.GMAIL_USER;
      const gmailPassword = process.env.GMAIL_APP_PASSWORD;
      
      if (!gmailUser || !gmailPassword) {
        results.services.email = {
          status: 'unhealthy',
          error: 'Gmail credentials not configured'
        };
      } else {
        const transporter = nodemailer.createTransporter({
          service: 'gmail',
          auth: { user: gmailUser, pass: gmailPassword }
        });
        await transporter.verify();
        results.services.email = { status: 'healthy' };
      }
    } catch (error) {
      results.services.email = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Email service failed'
      };
    }

    // Test payment gateway
    try {
      const keyId = process.env.RAZORPAY_KEY_ID;
      const keySecret = process.env.RAZORPAY_KEY_SECRET;
      
      if (!keyId || !keySecret) {
        results.services.payments = {
          status: 'unhealthy',
          error: 'Razorpay credentials not configured'
        };
      } else {
        results.services.payments = { status: 'healthy' };
      }
    } catch (error) {
      results.services.payments = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Payment service failed'
      };
    }

    // Calculate summary
    results.summary.total = Object.keys(results.services).length;
    results.summary.healthy = Object.values(results.services).filter((s: any) => s.status === 'healthy').length;
    results.summary.unhealthy = results.summary.total - results.summary.healthy;

    // Determine overall status
    if (results.summary.unhealthy === 0) {
      results.overallStatus = results.summary.warnings > 0 ? 'degraded' : 'healthy';
    } else {
      results.overallStatus = 'unhealthy';
    }

    const responseTime = Date.now() - startTime;
    const statusCode = results.overallStatus === 'unhealthy' ? 503 : 200;

    res.status(statusCode).json({
      ...results,
      responseTime: `${responseTime}ms`
    });
  });

  /**
   * POST /api/health/test-email
   * Send test email to verify email configuration
   * Requires authentication in production
   */
  app.post('/api/health/test-email', async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email || !email.includes('@')) {
        return res.status(400).json({
          status: 'error',
          message: 'Valid email address required'
        });
      }

      // In production, require admin authentication
      if (process.env.NODE_ENV === 'production') {
        const authHeader = req.headers.authorization;
        const adminPassword = process.env.ADMIN_PASSWORD;
        
        if (!authHeader || !adminPassword || authHeader !== `Bearer ${adminPassword}`) {
          return res.status(401).json({
            status: 'error',
            message: 'Admin authentication required in production'
          });
        }
      }

      // 🛡️ SECURITY: Send test email using secure OTP service with IP tracking
      const ipAddress = req.ip || req.connection.remoteAddress || 'health-check';
      const userAgent = req.headers['user-agent'] as string || 'health-check-service';
      const result = await otpService.sendOTP(email, 'health_check', 'email', ipAddress, userAgent);
      
      if (result.success) {
        res.json({
          status: 'success',
          message: `Test email sent successfully to ${email}`,
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(503).json({
          status: 'error',
          message: result.message || 'Failed to send test email',
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Test email failed',
        timestamp: new Date().toISOString()
      });
    }
  });
}