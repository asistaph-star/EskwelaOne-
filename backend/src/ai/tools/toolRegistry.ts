import { DigiSkwelaTool } from './toolTypes.js';
import { AIToolDeclaration } from '../provider/aiProvider.interface.js';
import { principalTools } from './definitions/principalTools.js';
import { 
  getMyIncompleteGradesTool, 
  getMyTeachingOperationsTool, 
  getMyClassPerformanceTool 
} from './definitions/teacherTools.js';

class ToolRegistry {
  private tools: Map<string, DigiSkwelaTool> = new Map();

  register(tool: DigiSkwelaTool) {
    this.tools.set(tool.name, tool);
  }

  getTool(name: string): DigiSkwelaTool | undefined {
    return this.tools.get(name);
  }

  getAllTools(): DigiSkwelaTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Returns tool declarations filtered strictly by the user's authenticated roles and permissions.
   * Client-supplied roles are NEVER trusted.
   */
  getDeclarationsForUser(userRoles: string[], userPermissions: string[]): AIToolDeclaration[] {
    const authorizedDeclarations: AIToolDeclaration[] = [];

    for (const tool of this.tools.values()) {
      const hasRole = tool.allowedRoles.some(r => userRoles.includes(r));
      const hasPermissions = userPermissions.includes('*') || tool.requiredPermissions.every(p => userPermissions.includes(p));

      if (hasRole && hasPermissions) {
        authorizedDeclarations.push(tool.declaration);
      }
    }

    return authorizedDeclarations;
  }
}

export const toolRegistry = new ToolRegistry();

// ─── REGISTER PRINCIPAL V1 LOCKED TOOLS (PHASE C) ───────────────────
for (const tool of principalTools) {
  toolRegistry.register(tool);
}

// ─── REGISTER TEACHER TOOLS (PHASE B) ────────────────────────────────
toolRegistry.register(getMyIncompleteGradesTool);
toolRegistry.register(getMyTeachingOperationsTool);
toolRegistry.register(getMyClassPerformanceTool);

