# Feature Gap Analysis — Original Prototype vs. Current Rewrite

Based on a full read-through of the original `index.html`/`personnel.js` app
compared against the current React + Express + MySQL rewrite.

## 🔴 Missing entirely (not in the rewrite at all)

1. **Idle timeout / auto-logout** — original logs a user out after 5 minutes
   of inactivity, with a 1-minute warning banner first. No session timeout
   exists in the rewrite at all.

2. **Notification bell** — a bell icon in the nav with an unread badge:
   admins see count of pending requests awaiting their action; staff see
   count of files assigned to them awaiting acceptance. Not present.

3. **Auto-reject after 12 hours** — if an admin assigns a file and the
   recipient doesn't accept within 12 hours, the original automatically
   marks it `rejected_auto` (special users are exempt — no auto-reject for
   them). The rewrite's request lifecycle has no equivalent status or
   background check at all.

4. **Full request lifecycle** — original has 5 statuses: `pending` (user
   requested, awaiting admin approval) → `pending_accept` (admin
   assigned/approved, awaiting recipient acceptance) → `accepted` →
   `returned`, plus `rejected_auto`. The rewrite collapsed this to
   `requested`/`assigned`/`accepted`/`returned`/`declined` and lost the
   distinction between "user asked for it" and "admin approved it but
   they haven't confirmed receipt yet" — these are different steps with
   different people acting on them.

5. **Batch file requests** — original lets a user check multiple files
   (via search or by browsing) and submit one combined request for all of
   them at once ("Selected Files" panel). The rewrite only supports
   requesting one file at a time.

6. **File unavailability locking** — original disables the checkbox/button
   for any file that's currently out (assigned/pending/accepted), so two
   people can't both request the same physical file. The rewrite has no
   such check — nothing stops duplicate concurrent requests for one file.

7. **Personal file sub-categories** — original organizes personnel files
   into: Personal, Interns, and **Semi-Active** with 8 further sub-types
   (Retired, Deceased, Transferred, Dismissed, End of Contract, Resigned,
   Governor's Appointee, Olkalau Town Council). The rewrite's schema only
   has `general`/`personal`/`custom` — no sub-categories at all, meaning
   this categorization from your personnel data has nowhere to live.

8. **Rich per-file movement tracking** — original tracks, per assignment:
   **Registry Code**, **Action Folio**, **Last Folio**, **Reason**,
   file status as **Actioned / Not Actioned / Proceed To** (with 7 named
   destinations: Chief Public Service, CS, DHRM, DDHRM, HRO, Payroll,
   Fleet Manager), **Bring Up** note, and who returned it. The rewrite's
   `movements` table only has a generic `notes` field — none of these
   specific tracked fields exist.

9. **Bulk user actions** — original's Users page has checkboxes, "Select
   All", and bulk Edit / bulk Remove for multiple users at once. The
   rewrite only supports one user at a time.

10. **Unified file search** — original's main user-facing search searches
    personal AND general files together in one box, letting a user select
    results directly into a batch request. The rewrite splits this into a
    plain filtered list with per-row single "Request" buttons — not the
    same search-and-select workflow.

11. **File count breakdown by category** — original's stats show general
    vs. personal (active/interns/semi-active) vs. custom counts separately.
    The rewrite's new stats endpoint only returns one flat `totalFiles`
    number.

12. **"Confidential" file category** — original's Add Custom File form
    supports Confidential as a category option, alongside General/Personal.
    The rewrite only supports general/personal/custom.

## 🟡 Partially rebuilt, but simplified

- **Assign to user** — exists now (I added it last round), but skips the
  approval step: original's flow is request → admin approves/assigns →
  recipient accepts, whereas the rewrite's assign goes straight to
  "assigned", no separate approval stage matching `pending` status.
- **Movements page** — exists, but only shows 5 generic columns instead
  of the ~13 specific ones (Registry Code, Folio numbers, Reason, etc.)
  described above.
- **Total files stat** — exists now, but as one flat number instead of
  the category breakdown.
- **User management** — add/deactivate/reactivate all exist, but no bulk
  actions, and no file-category field on users.

## 🟢 Present in both (no gap)

- Login by file number + password, default password = ID number
- Admin vs. user vs. special roles
- 7-working-days due date for regular users, 3-month due date for special
  users (including Kenyan public holiday awareness)
- Registry file browsing, custom file creation
- Users never hard-deleted, only deactivated
- Append-only movement history (audit log)
