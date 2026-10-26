import helmet from 'helmet';
import { RequestHandler } from 'express';
import { config } from '../../config/env.js';

/**
 * Factory for HTTP security headers middleware powered by Helmet.
 * Configured specifically for DigiSkwela architecture:
 * - Prevents MIME-sniffing (nosniff)
 * - Clickjacking defense (X-Frame-Options: SAMEORIGIN & CSP frame-ancestors: 'self')
 * - Restrictive Referrer-Policy (strict-origin-when-cross-origin)
 * - Fine-grained Content-Security-Policy supporting React/Vite, OpenCV.js, and Google Fonts
 * - Preserves cross-origin media loading (/storage) via cross-origin CORP
 * - Environment-aware HSTS: active in production HTTPS, disabled in local development HTTP
 */
export function createSecurityHeadersMiddleware(isProduction = config.nodeEnv === 'production'): RequestHandler {
  return helmet({
    // 1. MIME Sniffing Protection
    xContentTypeOptions: true, // X-Content-Type-Options: nosniff

    // 2. Frame / Clickjacking Protection
    xFrameOptions: { action: 'sameorigin' }, // X-Frame-Options: SAMEORIGIN

    // 3. Referrer Policy
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },

    // 4. Content Security Policy
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        objectSrc: ["'none'"],
        scriptSrc: [
          "'self'",
          'https://docs.opencv.org',
        ],
        scriptSrcAttr: ["'none'"],
        styleSrc: [
          "'self'",
          'https://fonts.googleapis.com',
          "'unsafe-inline'", // Necessary for Emotion / Material-UI dynamic style injection and application shell
        ],
        connectSrc: [
          "'self'",
          config.corsOrigin,
          'http://localhost:5173',
          'http://localhost:5174',
          'http://localhost:4000',
          'ws://localhost:5173',
          'ws://localhost:5174',
          'https://docs.opencv.org',
        ],
        ...(isProduction ? { upgradeInsecureRequests: [] } : {}),
      },
    },

    // 5. Cross-Origin Resource Policy
    // Must be cross-origin so the frontend (port 5173/5174) can load uploaded media/documents from /storage
    crossOriginResourcePolicy: { policy: 'cross-origin' },

    // 6. Cross-Origin Opener Policy
    crossOriginOpenerPolicy: { policy: 'same-origin' },

    // 7. Strict-Transport-Security (HSTS)
    // Disabled in local HTTP development to prevent accidental browser lockouts;
    // Enabled in production deployments with 1-year max-age, includeSubDomains, and preload.
    hsts: isProduction
      ? {
          maxAge: 31536000, // 1 year (seconds)
          includeSubDomains: true,
          preload: true,
        }
      : false,

    // 8. DNS Prefetch Control & Cross-Domain Policies
    dnsPrefetchControl: { allow: false },
    xPermittedCrossDomainPolicies: { permittedPolicies: 'none' },
  });
}

export const securityHeaders = createSecurityHeadersMiddleware();
