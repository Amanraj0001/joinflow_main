-- AlterTable
ALTER TABLE "User" ADD COLUMN     "resetExpires" TIMESTAMP(3),
ADD COLUMN     "resetHash" TEXT,
ADD COLUMN     "sessionVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "verified" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "department" TEXT NOT NULL DEFAULT 'General',
ADD COLUMN     "personalEmail" TEXT,
ADD COLUMN     "plan" TEXT NOT NULL DEFAULT 'Approved';

-- AlterTable
ALTER TABLE "Template" ADD COLUMN     "custom" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "department" TEXT NOT NULL DEFAULT 'People',
ADD COLUMN     "detail" TEXT,
ADD COLUMN     "due" TIMESTAMP(3),
ADD COLUMN     "policyRef" TEXT,
ADD COLUMN     "review" TEXT NOT NULL DEFAULT 'Approved',
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'Rule';

-- AlterTable
ALTER TABLE "Policy" ADD COLUMN     "archived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "chunks" JSONB,
ADD COLUMN     "department" TEXT,
ADD COLUMN     "ownerId" TEXT,
ADD COLUMN     "processing" TEXT NOT NULL DEFAULT 'Ready',
ADD COLUMN     "sourcePdf" BYTEA;

-- CreateTable
CREATE TABLE "JobRole" (
    "name" TEXT NOT NULL,
    "steps" TEXT[],

    CONSTRAINT "JobRole_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "mime" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending Review',
    "reason" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Issue" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "updates" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notice" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicySuggestion" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicySuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Submission_employeeId_kind_key" ON "Submission"("employeeId", "kind");

-- CreateIndex
CREATE INDEX "Message_employeeId_createdAt_idx" ON "Message"("employeeId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notice_employeeId_key_key" ON "Notice"("employeeId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "User_resetHash_key" ON "User"("resetHash");

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notice" ADD CONSTRAINT "Notice_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Message" ADD COLUMN "hrId" TEXT NOT NULL;
UPDATE "Employee" SET "department"="job" WHERE "department"='General';
UPDATE "Task" t SET "due"=e."startDate", "department"=CASE WHEN m."category"='Equipment' THEN 'IT' WHEN m."category"='Payroll' THEN 'Finance' ELSE 'People' END FROM "Employee" e,"Template" m WHERE t."employeeId"=e.id AND t."templateId"=m.id;
INSERT INTO "JobRole" ("name","steps") VALUES ('Engineering',ARRAY['Configure the development environment','Review the engineering release process']),('Operations',ARRAY['Practice a shift handover','Review the operations escalation directory']);

-- Existing hires keep their active tasks. HR reviews their role-specific additions.
INSERT INTO "Template" (id,title,description,category,"ownerRole",required,job,position,custom)
SELECT 'role-'||md5(r.name||s.title), s.title, s.title||' for the '||r.name||' role.',
       r.name,'Employee',false,r.name,100,true
FROM "JobRole" r CROSS JOIN LATERAL unnest(r.steps) AS s(title);
INSERT INTO "Task" (id,"employeeId","templateId","ownerId",review,due,department,source)
SELECT 'step-'||md5(e.id||t.id),e.id,t.id,e."userId",'Draft',e."startDate",e.department,'Role'
FROM "Employee" e JOIN "Template" t ON t.custom AND t.job=e.job;

ALTER TABLE "Issue" ADD COLUMN "triage" JSONB;

ALTER TABLE "Policy" ADD COLUMN "sourceText" TEXT;

ALTER TABLE "User" ADD COLUMN department TEXT NOT NULL DEFAULT 'People';
UPDATE "User" SET department='IT' WHERE role='Manager';
