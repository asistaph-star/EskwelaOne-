import { apiClient } from './client';
import { DocumentRequest } from '../app/shared/types';

export const documentsApi = {
  getAllRequests: () => apiClient.get<DocumentRequest[]>('/student-services/doc-requests'),
  
  createRequest: (req: Partial<DocumentRequest>) => 
    apiClient.post<DocumentRequest>('/student-services/doc-requests', req),
    
  updateRequest: (id: string, updates: Partial<DocumentRequest>) => 
    apiClient.patch<DocumentRequest>(`/documents/requests/${id}`, updates)
};
