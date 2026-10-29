-- Enforce delivery-level uniqueness: no student or question can be allocated to multiple evaluators in the same delivery
CREATE UNIQUE INDEX IF NOT EXISTS "copy_checker_student_allocations_assessmentDeliveryId_studentProfileId_key"
ON "copy_checker_student_allocations"("assessmentDeliveryId", "studentProfileId");

CREATE UNIQUE INDEX IF NOT EXISTS "copy_checker_question_allocations_assessmentDeliveryId_questionId_key"
ON "copy_checker_question_allocations"("assessmentDeliveryId", "questionId");
