import path from 'path';
import fs from 'fs';

export function getMediaStoragePath(): string {
  // Use explicit environment variable for production persistent storage mounts
  if (process.env.MEDIA_STORAGE_PATH) {
    return process.env.MEDIA_STORAGE_PATH;
  }
  
  // Safe local development fallback
  return path.join(process.cwd(), 'storage', 'documents');
}

export function initMediaStorage(): void {
  const mediaPath = getMediaStoragePath();
  
  // Warn if production is lacking a configured persistent volume
  if (process.env.NODE_ENV === 'production' && !process.env.MEDIA_STORAGE_PATH) {
    console.warn(
      '-------------------------------------------------------------------------\n' +
      '[WARNING] PRODUCTION ENVIRONMENT DETECTED WITHOUT MEDIA_STORAGE_PATH.\n' +
      'Campus Media uploads will be written to the ephemeral working directory\n' +
      'and may be permanently lost upon container restart or deployment.\n' +
      'Please configure a persistent disk and set MEDIA_STORAGE_PATH.\n' +
      '-------------------------------------------------------------------------'
    );
  }

  try {
    if (!fs.existsSync(mediaPath)) {
      console.log(`[Storage] Creating media storage directory at: ${mediaPath}`);
      fs.mkdirSync(mediaPath, { recursive: true });
    }
    
    // Verify directory is writable
    fs.accessSync(mediaPath, fs.constants.W_OK);
  } catch (error) {
    console.error(`[FATAL ERROR] Failed to access or create media storage at: ${mediaPath}`);
    console.error(error);
    
    // Fail fast in production if an explicit path was requested but cannot be used
    if (process.env.NODE_ENV === 'production' && process.env.MEDIA_STORAGE_PATH) {
      console.error('[FATAL ERROR] The configured MEDIA_STORAGE_PATH is not writable. Exiting.');
      process.exit(1);
    }
  }
}
