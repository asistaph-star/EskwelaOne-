import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = __dirname.includes('dist') 
  ? path.resolve(__dirname, '../../../.env')
  : path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',

  jwt: {
    secret: process.env.JWT_SECRET || 'CHANGE_ME_INSECURE_DEV_SECRET',
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  },

  s3: {
    endpoint: process.env.S3_ENDPOINT || '',
    region: process.env.S3_REGION || 'us-east-1',
    bucket: process.env.S3_BUCKET || 'digiskwela-documents',
    accessKey: process.env.S3_ACCESS_KEY || '',
    secretKey: process.env.S3_SECRET_KEY || '',
    presignedExpiry: parseInt(process.env.S3_PRESIGNED_EXPIRY_SECONDS || '300', 10),
  },
} as const;
