export type Role = 'admin' | 'user' | 'special';

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

export const SUB_CATEGORY_OPTIONS = Object.entries(SUB_CATEGORY_LABELS) as [SubCategory, string][];

// Lightweight shape returned by GET /users/directory — used to populate
// Assign-to dropdowns with the FULL active user list (no pagination cap),
// unlike SafeUser which comes from the paginated/search-limited GET /users.
export interface UserDirectoryEntry {
  id: number;
  file_number: string;
  name: string;
  role: Role;
}

export interface SafeUser {
  id: number;
  file_number: string;
  name: string;
  designation: string;
  id_number: string | null;
  role: Role;
  file_category: SubCategory;
  must_change_password: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export type FileCategory = 'general' | 'personal' | 'custom' | 'confidential';

export interface RegistryFile {
  id: number;
  file_id: string;
  file_name: string;
  file_number: string;
  category: FileCategory;
  sub_category: SubCategory | null;
  owner_user_id: number | null;
  is_unavailable: number; // 0 or 1 (MySQL boolean-as-int)
  created_at: string;
  updated_at: string;
}

export type RequestStatus = 'pending' | 'pending_accept' | 'accepted' | 'returned' | 'rejected_auto';

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  pending: 'Pending Approval',
  pending_accept: 'Awaiting Acceptance',
  accepted: 'Accepted',
  returned: 'Returned',
  rejected_auto: 'Auto-Rejected (no response)',
};

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

export interface RegistryRequest {
  id: number;
  file_id: number;
  registry_code: string | null;
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
  action_folio: string | null;
  last_folio: string | null;
  reason: string | null;
  file_status: 'actioned' | 'not_actioned' | 'proceed_to' | null;
  proceed_to_dest: ProceedToDest | null;
  bring_up_note: string | null;
  returned_by_id: number | null;
  returned_by_name: string | null;
}

export interface StatsBreakdown {
  general: number;
  personalTotal: number;
  personalActive: number;
  interns: number;
  semiActive: number;
  custom: number;
}

export interface Stats {
  totalFiles: number;
  breakdown: StatsBreakdown;
  totalActiveUsers: number;
  totalAdmins: number;
  totalRegularUsers: number;
  pendingRequests: number;
  overdueRequests: number;
  assignedFiles: number;
  remainingFiles: number;
  rejectedFiles: number;
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
  registry_code: string | null;
  action_folio: string | null;
  last_folio: string | null;
  reason: string | null;
  file_status: 'actioned' | 'not_actioned' | 'proceed_to' | null;
  proceed_to_dest: ProceedToDest | null;
  bring_up_note: string | null;
  request_assigned_date: string | null;
  request_returned_date: string | null;
  created_at: string;
}
