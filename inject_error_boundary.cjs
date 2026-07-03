const fs = require('fs');
const path = require('path');

const mainPath = path.join(__dirname, 'src', 'main.tsx');
let mainContent = fs.readFileSync(mainPath, 'utf8');

const errorBoundaryCode = `
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
        <div style={{ padding: 20, background: "#fee", color: "#900", fontFamily: "monospace" }}>
          <h1>React Crashed</h1>
          <pre>{this.state.error?.toString()}</pre>
          <pre>{this.state.info?.componentStack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}
`;

if (!mainContent.includes('ErrorBoundary')) {
  mainContent = mainContent.replace(
    'import { AppProvider } from "./app/shared/AppContext.tsx";',
    'import { AppProvider } from "./app/shared/AppContext.tsx";\n' + errorBoundaryCode
  );

  mainContent = mainContent.replace(
    '<AppProvider>',
    '<ErrorBoundary>\n    <AppProvider>'
  );

  mainContent = mainContent.replace(
    '</AppProvider>',
    '</AppProvider>\n    </ErrorBoundary>'
  );

  fs.writeFileSync(mainPath, mainContent, 'utf8');
  console.log('Injected ErrorBoundary!');
} else {
  console.log('ErrorBoundary already exists.');
}
