
Changelog
2026-09-27
e0da826

fix: redirect root to application dashboard

Removed obsolete root application UI.
Root route now enters the application dashboard flow.
03b21d0

feat: add canonical extracted item student matching

Added canonical student matching flow.
Student resolution is tenant-scoped.
Verification no longer creates synthetic students.
Unresolved student identity blocks PASSED verification.
4db3c3b

fix: prevent invalid student creation during verification

Removed automatic fake student creation during verification.
Added explicit validation when student identity cannot be resolved.
d4f0469

feat: migrate verification page to canonical workflow

Migrated verification page to canonical workflow actions.
Verification UI now consumes canonical OCR document workflow data.
