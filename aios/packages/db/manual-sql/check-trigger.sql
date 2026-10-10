SELECT tgname, tgenabled FROM pg_trigger WHERE tgname = 'audit_logs_immutable';
