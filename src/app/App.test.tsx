import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';
import * as AppContextModule from './shared/AppContext';

// Mock all portal components so we can just check if they render
vi.mock('./teacher/TeacherApp', () => ({ TeacherApp: () => <div data-testid="portal-teacher">Teacher Portal</div> }));
vi.mock('./admin/AdminApp', () => ({ AdminApp: () => <div data-testid="portal-admin">Admin Portal</div> }));
vi.mock('./principal/PrincipalApp', () => ({ PrincipalApp: () => <div data-testid="portal-principal">Principal Portal</div> }));
vi.mock('./student/StudentPortal', () => ({ StudentPortal: () => <div data-testid="portal-student">Student Portal</div> }));
vi.mock('./nurse/NurseApp', () => ({ NurseApp: () => <div data-testid="portal-nurse">Nurse Portal</div> }));
vi.mock('./guidance/GuidanceApp', () => ({ GuidanceApp: () => <div data-testid="portal-guidance">Guidance Portal</div> }));
vi.mock('./registrar/RegistrarApp', () => ({ RegistrarApp: () => <div data-testid="portal-registrar">Registrar Portal</div> }));
vi.mock('./gate/GateTerminalApp', () => ({ GateTerminalApp: () => <div data-testid="portal-gate">Gate Portal</div> }));
vi.mock('./parent/SimpleShell', () => ({ SimpleShell: () => <div data-testid="portal-parent">Parent Portal</div> }));
vi.mock('./auth/login/LoginScreen', () => ({ LoginScreen: () => <div data-testid="portal-login">Login Screen</div> }));

describe('App Portal Routing Regression Guard', () => {
  const renderWithRole = (role: string | null | undefined) => {
    // Mock the context
    vi.spyOn(AppContextModule, 'useAppContext').mockReturnValue({
      currentUser: role !== null ? { id: '1', name: 'Test User', role, permissions: [], rawRoles: [role], studentProfile: null } : null,
      setCurrentUser: vi.fn(),
      // mock other necessary methods if required
    } as any);

    return render(<App />);
  };

  it('routes to LoginScreen when no currentUser', () => {
    renderWithRole(null);
    expect(screen.getByTestId('portal-login')).toBeInTheDocument();
  });

  it('routes to TeacherApp when role is Teacher', () => {
    renderWithRole('Teacher');
    expect(screen.getByTestId('portal-teacher')).toBeInTheDocument();
  });

  it('routes to AdminApp when role is Admin or ITAdmin', () => {
    const { unmount } = renderWithRole('Admin');
    expect(screen.getByTestId('portal-admin')).toBeInTheDocument();
    unmount();

    renderWithRole('ITAdmin');
    expect(screen.getByTestId('portal-admin')).toBeInTheDocument();
  });

  it('routes to PrincipalApp when role is Principal', () => {
    renderWithRole('Principal');
    expect(screen.getByTestId('portal-principal')).toBeInTheDocument();
  });

  it('routes to StudentPortal when role is Student', () => {
    renderWithRole('Student');
    expect(screen.getByTestId('portal-student')).toBeInTheDocument();
  });

  it('routes to NurseApp when role is Nurse', () => {
    renderWithRole('Nurse');
    expect(screen.getByTestId('portal-nurse')).toBeInTheDocument();
  });

  it('routes to GuidanceApp when role is Guidance', () => {
    renderWithRole('Guidance');
    expect(screen.getByTestId('portal-guidance')).toBeInTheDocument();
  });

  it('routes to RegistrarApp when role is Registrar', () => {
    renderWithRole('Registrar');
    expect(screen.getByTestId('portal-registrar')).toBeInTheDocument();
  });

  it('routes to GateTerminalApp when role is GateOperator', () => {
    renderWithRole('GateOperator');
    expect(screen.getByTestId('portal-gate')).toBeInTheDocument();
  });

  it('displays Access Denied for unknown roles instead of falling through to TeacherApp', () => {
    renderWithRole('UnknownFakeRole');
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.queryByTestId('portal-teacher')).not.toBeInTheDocument();
  });

  it('displays Access Denied for undefined roles', () => {
    renderWithRole(undefined);
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.queryByTestId('portal-teacher')).not.toBeInTheDocument();
  });
});
