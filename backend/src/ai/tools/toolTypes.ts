import { z } from 'zod';
import { AuthenticatedUser } from '../../common/middleware/auth.js';
import { AIToolDeclaration } from '../provider/aiProvider.interface.js';

export interface AIExecutionContext {
  user: AuthenticatedUser;
  correlationId?: string;
  portal: string;
}

export interface DigiSkwelaTool<TInput = any, TOutput = any> {
  id: string;
  name: string;
  description: string;
  allowedRoles: string[];
  requiredPermissions: string[];
  inputSchema: z.ZodType<TInput>;
  declaration: AIToolDeclaration;
  timeoutMs?: number;
  maxResults?: number;
  
  /**
   * Domain service execution handler.
   * MUST call authorized domain services, never arbitrary Prisma queries.
   */
  execute(args: TInput, context: AIExecutionContext): Promise<TOutput>;
}
