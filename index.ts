export type Role = 'admin' | 'user' | 'special';

export interface UserRow {
  id: number;
  file_number: string;
  name: string;
  designation: string;
  id_number: string | null;
  role: Role;
  password_hash: string;
  must_change_password: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export type SafeUser = Omit<UserRow, 'password_hash'>;

export type FileCategory = 'general' | 'personal' | 'custom';

export interface RegistryFileRow {
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

export interface RequestRow {
  id: number;
  file_id: number;
  requester_id: number | null;
  assigned_to_id: number | null;
  status: RequestStatus;
  requested_date: string | null;
  assigned_date: string | null;
  accepted_date: string | null;
  returned_date: string | null;
  due_date: string | null;
  bring_up_note: string | null;
  proceed_to: string | null;
  created_at: string;
  updated_at: string;
}

export type MovementAction =
  | 'requested'
  | 'assigned'
  | 'accepted'
  | 'returned'
  | 'declined'
  | 'reassigned';

export interface MovementRow {
  id: number;
  request_id: number;
  file_id: number;
  action: MovementAction;
  actor_user_id: number | null;
  subject_user_id: number | null;
  notes: string | null;
  created_at: string;
}

export interface AuthTokenPayload {
  sub: number;
  fileNumber: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}
