import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 4000,
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  apiUrl: process.env.API_URL || 'http://localhost:4000',

  database: {
    host: process.env.DATABASE_HOST || process.env.DB_HOST || 'localhost',
    port: Number(process.env.DATABASE_PORT || process.env.DB_PORT) || 5432,
    name: process.env.DATABASE_NAME || process.env.DB_NAME || 'worksphere',
    user: process.env.DATABASE_USER || process.env.DB_USER || 'worksphere_user',
    password: process.env.DATABASE_PASSWORD || process.env.DB_PASSWORD || 'devpassword',
    ssl: process.env.DATABASE_SSL === 'true',
    poolMin: Number(process.env.DATABASE_POOL_MIN) || 2,
    poolMax: Number(process.env.DATABASE_POOL_MAX) || 10,
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    enabled: process.env.REDIS_ENABLED !== 'false',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production-min-32-chars',
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
    bcryptRounds: Number(process.env.BCRYPT_ROUNDS) || 10,
  },

  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    from: process.env.EMAIL_FROM || 'noreply@worksphere.example.com',
  },

  s3: {
    endpoint: process.env.S3_ENDPOINT || '',
    bucket: process.env.S3_BUCKET || 'worksphere-uploads',
    accessKey: process.env.S3_ACCESS_KEY || '',
    secretKey: process.env.S3_SECRET_KEY || '',
    region: process.env.S3_REGION || 'us-east-1',
    localUploadDir: process.env.LOCAL_UPLOAD_DIR || path.resolve(__dirname, '../../uploads'),
  },

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || 'whsec_placeholder',
    priceId: process.env.STRIPE_PRICE_ID || 'price_pro_monthly',
  },

  analytics: {
    url: process.env.PYTHON_SERVICE_URL || 'http://localhost:8000',
    apiKey: process.env.ANALYTICS_SERVICE_API_KEY || 'ws-analytics-default-key',
    timeoutMs: Number(process.env.ANALYTICS_TIMEOUT_MS) || 5000,
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
  },
};
