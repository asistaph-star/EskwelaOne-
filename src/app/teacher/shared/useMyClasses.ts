import { useState, useEffect } from 'react';
import { apiClient } from '../../../api/client';

export function useMyClasses() {
  const [myClasses, setMyClasses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    apiClient.get('/academic/my-classes')
      .then((res: any) => {
        if (Array.isArray(res)) {
          setMyClasses(res);
        } else {
          setMyClasses([]);
        }
      })
      .catch((err) => {
        console.error('Failed to load classes:', err);
        setMyClasses([]);
      })
      .finally(() => setIsLoading(false));
  }, []);

  return { myClasses, isLoading };
}
