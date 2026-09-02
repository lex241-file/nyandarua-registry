export type Role = 'admin' | 'user' | 'special';

export interface UserRow {
  id: number;
  file_number: string;
  name: string;
  designation: string;
  id_number: string | null;
  role: Role;
  file_category: SubCategory;
  password_hash: string;
  must_change_password: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export type SafeUser = Omit<UserRow, 'password_hash'>;

export type FileCategory = 'general' | 'personal' | 'custom' | 'confidential';

export type SubCategory =
  | 'personal' | 'interns' | 'retired' | 'deceased' | 'transferred'
  | 'dismissed' | 'end_contract' | 'resigned' | 'gov_appointee' | 'olkalau';

export const SUB_CATEGORY_LABELS: Record<SubCategory, string> = {
  personal: 'Personal Files',
  interns: 'Interns',
  retired: 'Semi Active — Retired',
  deceased: 'Semi Active — Deceased',
  transferred: 'Semi Active — Transferred',
  dismissed: 'Semi Active — Dismissed',
  end_contract: 'Semi Active — End of Contract',
  resigned: 'Semi Active — Resigned',
  gov_appointee: "Semi Active — Governor's Appointee",
  olkalau: 'Semi Active — Olkalau Town Council',
};

export interface RegistryFileRow {
  id: number;
  file_id: string;
  file_name: string;
  file_number: string;
  category: FileCategory;
  sub_category: SubCategory | null;
  owner_user_id: number | null;
  created_at: string;
  updated_at: string;
}

export type RequestStatus = 'pending' | 'pending_accept' | 'accepted' | 'returned' | 'rejected_auto';

export type ProceedToDest =
  | 'chief_public_service' | 'cs' | 'dhrm' | 'ddhrm' | 'hro' | 'payroll' | 'fleet_manager';

export const PROCEED_TO_LABELS: Record<ProceedToDest, string> = {
  chief_public_service: 'Chief Public Service',
  cs: 'CS',
  dhrm: 'DHRM',
  ddhrm: 'DDHRM',
  hro: 'HRO',
  payroll: 'Payroll',
  fleet_manager: 'Fleet Manager',
};

export interface RequestRow {
  id: number;
  file_id: number;
  registry_code: string | null;
  requester_id: number | null;
  assigned_to_id: number | null;
  status: RequestStatus;
  requested_date: string | null;
  assigned_date: string | null;
  accepted_date: string | null;
  returned_date: string | null;
  due_date: string | null;
  action_folio: string | null;
  last_folio: string | null;
  reason: string | null;
  file_status: 'actioned' | 'not_actioned' | 'proceed_to' | null;
  proceed_to_dest: ProceedToDest | null;
  bring_up_note: string | null;
  proceed_to: string | null;
  returned_by_id: number | null;
  created_at: string;
  updated_at: string;
}

export type MovementAction =
  | 'requested'
  | 'pending_accept'
  | 'accepted'
  | 'returned'
  | 'rejected_auto'
  | 'reassigned';

export interface MovementRow {
  id: number;
  request_id: number;
  file_id: number;
  action: MovementAction;
  actor_user_id: number | null;
  subject_user_id: number | null;
  notes: string | null;
  registry_code: string | null;
  action_folio: string | null;
  last_folio: string | null;
  reason: string | null;
  file_status: 'actioned' | 'not_actioned' | 'proceed_to' | null;
  proceed_to_dest: ProceedToDest | null;
  bring_up_note: string | null;
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
