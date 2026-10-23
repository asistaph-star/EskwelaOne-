import { toolRegistry } from './toolRegistry.js';
import { AIExecutionContext } from './toolTypes.js';
import { minimizePayload } from './dataMinimizer.js';
import { AppError } from '../../common/middleware/errorHandler.js';
import { aiConfig } from '../../config/ai.config.js';

export interface ToolExecutionResult {
  toolName: string;
  success: boolean;
  data?: any;
  error?: string;
  executionTimeMs: number;
}

/**
 * Executes a requested tool strictly under server-side authentication & RBAC.
 * 
 * Invariants:
 * 1. Checks tool existence in registry (no arbitrary execution).
 * 2. Checks authenticated user roles (never trusts client/prompt claims).
 * 3. Checks required permissions.
 * 4. Strictly validates arguments via Zod schema.
 * 5. Applies execution timeout guard.
 * 6. Passes result through data minimizer to strip PII and sensitive fields.
 */
export async function dispatchTool(
  toolName: string,
  rawArgs: Record<string, any>,
  context: AIExecutionContext
): Promise<ToolExecutionResult> {
  const startTime = Date.now();
  const tool = toolRegistry.getTool(toolName);

  // 1. Tool Existence Check
  if (!tool) {
    throw new AppError(400, 'UNKNOWN_TOOL', `Tool '${toolName}' is not registered or permitted.`);
  }

  // 2. Server-Side Role Authorization
  const userRoles = context.user.roles || [];
  const hasRole = tool.allowedRoles.some(r => userRoles.includes(r));
  if (!hasRole) {
    throw new AppError(403, 'FORBIDDEN', `Role '${userRoles.join(',')}' is not authorized to execute '${toolName}'.`);
  }

  // 3. Server-Side Permission Authorization
  const userPerms = context.user.permissions || [];
  const hasPermissions = tool.requiredPermissions.every(p => userPerms.includes(p));
  if (!hasPermissions) {
    throw new AppError(403, 'FORBIDDEN', `User lacks required permissions for tool '${toolName}'.`);
  }

  // 4. Strict Zod Schema Validation
  const cleanedArgs = rawArgs && typeof rawArgs === 'object' && !Array.isArray(rawArgs)
    ? Object.fromEntries(Object.entries(rawArgs).filter(([_, v]) => v !== null && v !== ''))
    : rawArgs;
  const parseResult = tool.inputSchema.safeParse(cleanedArgs);
  if (!parseResult.success) {
    throw new AppError(
      400,
      'INVALID_TOOL_ARGUMENTS',
      `Malformed arguments for '${toolName}': ${parseResult.error.message}`
    );
  }

  // 5. Execution with Configurable Timeout Guard
  const timeoutMs = tool.timeoutMs || aiConfig.limits.toolTimeoutMs;
  let timeoutHandle: any;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new AppError(504, 'TOOL_TIMEOUT', `Tool '${toolName}' execution timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
  });

  try {
    const rawResult = await Promise.race([
      tool.execute(parseResult.data, context),
      timeoutPromise
    ]);

    // 6. Data Minimization & Result Limiting
    let minimized = minimizePayload(rawResult);

    if (Array.isArray(minimized) && minimized.length > aiConfig.limits.maxToolResults) {
      minimized = minimized.slice(0, aiConfig.limits.maxToolResults);
    }

    return {
      toolName,
      success: true,
      data: minimized,
      executionTimeMs: Date.now() - startTime
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
}
