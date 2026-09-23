  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import { AppProvider } from "./app/shared/AppContext.tsx";

import React, { Component, ErrorInfo, ReactNode } from "react";
class ErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean, error: Error | null, info: ErrorInfo | null}> {
  constructor(props: {children: ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ info });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ flex: 1, height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f8fafc" }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1e293b", marginBottom: 16 }}>Something went wrong.</h1>
          <p style={{ fontSize: 14, color: "#64748b", marginBottom: 24 }}>An unexpected application error occurred.</p>
          {this.state.error && (
            <pre style={{ maxWidth: "80%", background: "#f1f5f9", padding: 16, borderRadius: 8, overflow: "auto", fontSize: 12, color: "#ef4444" }}>
              {this.state.error.message}{"\n"}{this.state.error.stack}
            </pre>
          )}
          <button onClick={() => window.location.reload()} style={{ padding: "10px 20px", background: "#0f172a", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, marginTop: 16 }}>Refresh Page</button>
        </div>
      );
    }
    return this.props.children;
  }
}

  import "./styles/index.css";

  createRoot(document.getElementById("root")!).render(
    <ErrorBoundary>
    <AppProvider>
      <App />
    </AppProvider>
    </ErrorBoundary>
  );