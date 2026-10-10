INSERT INTO institutes ("id", "name", "plan", "createdAt", "updatedAt") VALUES ('test-inst', 'Test', 'TRIAL', NOW(), NOW()) ON CONFLICT DO NOTHING;
INSERT INTO audit_logs ("id", "instituteId", "actorId", "action", "entity", "entityId", "oldValue", "newValue", "createdAt")
VALUES ('test-1', 'test-inst', 'actor-1', 'CREATE', 'Exam', 'exam-1', NULL, '{}', NOW()) ON CONFLICT DO NOTHING;
UPDATE audit_logs SET "actorId" = 'hacked' WHERE "id" = 'test-1';
