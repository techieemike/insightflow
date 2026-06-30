-- CreateTable
CREATE TABLE "Dataset" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "totalRecords" INTEGER NOT NULL,
    "columns" JSONB NOT NULL,
    "sampleRows" JSONB NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "qualityScore" DOUBLE PRECISION,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "missingCount" INTEGER NOT NULL DEFAULT 0,
    "emptyRowCount" INTEGER NOT NULL DEFAULT 0,
    "insights" JSONB,

    CONSTRAINT "Dataset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataRecord" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "isDuplicate" BOOLEAN NOT NULL DEFAULT false,
    "isEmptyRow" BOOLEAN NOT NULL DEFAULT false,
    "rowHash" TEXT,

    CONSTRAINT "DataRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DataRecord_datasetId_idx" ON "DataRecord"("datasetId");

-- CreateIndex
CREATE INDEX "DataRecord_rowHash_idx" ON "DataRecord"("rowHash");

-- AddForeignKey
ALTER TABLE "DataRecord" ADD CONSTRAINT "DataRecord_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
