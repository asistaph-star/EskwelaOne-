import React from 'react';
import { GradebookFullScreen } from './GradebookFullScreen';
import { useMyClasses } from '../shared/useMyClasses';
import { EmptyState } from '../../shared/components/EmptyState';
import { BookOpen } from 'lucide-react';


export function GradesDirectScreen() {
  const { myClasses, isLoading } = useMyClasses();

  if (isLoading) {
    return <div>Loading classes...</div>;
  }

  const defaultClassId = myClasses?.[0]?.id;

  if (!defaultClassId) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <EmptyState
          icon={BookOpen}
          title="No Classes Assigned"
          description="You don't have any sections assigned for this academic year yet."
          guidance="Once an administrator assigns you to a section, your gradebooks will appear here."
        />
      </div>
    );
  }

  return <GradebookFullScreen classId={defaultClassId} onBack={()=>{}} hideBack />;
}

/* ─── AttendanceDirectScreen ─────────────────────────────── */