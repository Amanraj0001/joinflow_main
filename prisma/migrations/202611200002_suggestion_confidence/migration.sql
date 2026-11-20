ALTER TABLE "Task" ADD COLUMN "confidence" DOUBLE PRECISION;
ALTER TABLE "Task" ADD CONSTRAINT "Task_confidence_range" CHECK ("confidence" BETWEEN 0 AND 1);
