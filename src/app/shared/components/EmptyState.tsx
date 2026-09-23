import React from 'react';
import { C } from '../constants/tokens';
import { LucideIcon } from 'lucide-react';

export function EmptyState({
  icon: Icon,
  title,
  description,
  guidance,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  guidance?: string;
}) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '400px',
      padding: '40px 20px',
      background: '#fff',
      border: `1px solid ${C.border}`,
      borderRadius: '12px',
      boxShadow: '0 6px 16px rgba(139,30,30,0.03)',
      textAlign: 'center',
      margin: '20px auto',
      maxWidth: '600px',
      width: '100%',
    }}>
      <div style={{
        background: C.m50,
        padding: '24px',
        borderRadius: '50%',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Icon size={48} color={C.m700} strokeWidth={1.5} />
      </div>
      
      <h2 style={{
        fontSize: '24px',
        fontWeight: 800,
        color: C.t1,
        fontFamily: "'Fraunces', serif",
        margin: '0 0 12px 0',
      }}>
        {title}
      </h2>
      
      <p style={{
        fontSize: '15px',
        color: C.t2,
        margin: '0 0 16px 0',
        lineHeight: 1.5,
        maxWidth: '400px',
      }}>
        {description}
      </p>
      
      {guidance && (
        <p style={{
          fontSize: '13px',
          color: C.t3,
          margin: 0,
          lineHeight: 1.5,
          maxWidth: '380px',
        }}>
          {guidance}
        </p>
      )}
    </div>
  );
}
