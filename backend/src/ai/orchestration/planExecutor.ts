import { dispatchTool } from '../tools/toolDispatcher.js';
import { AuthenticatedUser } from '../../common/middleware/auth.js';
import { PlannedToolDispatch } from './requestPlanner.js';

export interface ExecutedToolResult {
  name: string;
  args: Record<string, any>;
  result: any;
  success: boolean;
  error?: string;
  toolCallId: string;
}

export interface PlanExecutionOutput {
  toolsRequested: string[];
  toolsExecuted: string[];
  executedResults: ExecutedToolResult[];
  deterministicToolCalls: Array<{ id: string; name: string; arguments: any }>;
}

/**
 * Executes planned tools under strict authorization, recording successes and failures.
 */
export async function executePlan(
  toolsToExecute: PlannedToolDispatch[],
  authUser: AuthenticatedUser,
  correlationId: string | undefined,
  portal: string,
  allowedToolNames: Set<string>
): Promise<PlanExecutionOutput> {
  const toolsRequested: string[] = [];
  const toolsExecuted: string[] = [];
  const executedResults: ExecutedToolResult[] = [];
  const deterministicToolCalls: Array<{ id: string; name: string; arguments: any }> = [];

  for (let i = 0; i < toolsToExecute.length; i++) {
    const item = toolsToExecute[i];
    if (!allowedToolNames.has(item.name)) {
      continue;
    }

    const callId = `call_det_${i}_${item.name}`;
    toolsRequested.push(item.name);
    deterministicToolCalls.push({
      id: callId,
      name: item.name,
      arguments: item.args || {}
    });

    try {
      const toolRes = await dispatchTool(item.name, item.args || {}, {
        user: authUser,
        correlationId,
        portal
      });

      toolsExecuted.push(item.name);
      executedResults.push({
        name: item.name,
        args: item.args || {},
        result: toolRes.data,
        success: true,
        toolCallId: callId,
      });
    } catch (err: any) {
      executedResults.push({
        name: item.name,
        args: item.args || {},
        result: null,
        success: false,
        error: err.message || 'Execution failed',
        toolCallId: callId,
      });
    }
  }

  return {
    toolsRequested,
    toolsExecuted,
    executedResults,
    deterministicToolCalls,
  };
}
