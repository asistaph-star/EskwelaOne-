/**
 * Global DOM Safety Monkey-Patch for React.
 * Prevents "NotFoundError: Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node."
 * and related insertBefore crashes caused by browser extensions (e.g., Google Translate, Grammarly, password managers)
 * or external DOM scripts modifying/wrapping nodes outside of React's reconciliation cycle.
 */
export function initDOMSafety() {
  if (typeof window === "undefined" || typeof Node === "undefined" || !Node.prototype) {
    return;
  }

  const windowWithFlag = window as any;
  if (windowWithFlag.__domSafetyInitialized) {
    return;
  }
  windowWithFlag.__domSafetyInitialized = true;

  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    if (child.parentNode !== this) {
      if (typeof console !== "undefined" && console.warn) {
        console.warn(
          "Prevented removeChild crash: The node to be removed is not a child of this node.",
          { child, parent: this }
        );
      }
      return child;
    }
    return originalRemoveChild.call(this, child) as T;
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(
    newNode: T,
    referenceNode: Node | null
  ): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      if (typeof console !== "undefined" && console.warn) {
        console.warn(
          "Prevented insertBefore crash: The reference node is not a child of this parent node.",
          { newNode, referenceNode, parent: this }
        );
      }
      return this.appendChild(newNode) as T;
    }
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  };
}
