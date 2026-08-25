export type Role = 'admin' | 'user' | 'special';

export interface SafeUser {
  id: number;
  file_number: string;
  name: string;
  designation: string;
  id_number: string | null;
  role: Role;
  must_change_password: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export type FileCategory = 'general' | 'personal' | 'custom';

export interface RegistryFile {
  id: number;
  file_id: string;
  file_name: string;
  file_number: string;
  category: FileCategory;
  owner_user_id: number | null;
  created_at: string;
  updated_at: string;
}

export type RequestStatus = 'requested' | 'assigned' | 'accepted' | 'returned' | 'declined';

export interface RegistryRequest {
  id: number;
  file_id: number;
  file_name: string;
  file_number_label: string;
  requester_id: number | null;
  requester_name: string | null;
  assigned_to_id: number | null;
  assigned_to_name: string | null;
  status: RequestStatus;
  requested_date: string | null;
  assigned_date: string | null;
  accepted_date: string | null;
  returned_date: string | null;
  due_date: string | null;
  bring_up_note: string | null;
  proceed_to: string | null;
}

export interface Movement {
  id: number;
  request_id: number;
  file_id: number;
  file_name: string;
  file_number_label: string;
  action: string;
  actor_user_id: number | null;
  actor_name: string | null;
  subject_user_id: number | null;
  subject_name: string | null;
  notes: string | null;
  created_at: string;
}
