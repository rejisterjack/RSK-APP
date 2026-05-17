/*
  Warnings:

  - You are about to drop the `document_chunks` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `image_embeddings` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "document_chunks" DROP CONSTRAINT "document_chunks_documentId_fkey";

-- DropForeignKey
ALTER TABLE "document_images" DROP CONSTRAINT "document_images_chunkId_fkey";

-- DropIndex
DROP INDEX "document_images_chunkId_idx";

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "chunkCount" INTEGER NOT NULL DEFAULT 0;

-- DropTable
DROP TABLE "document_chunks";

-- DropTable
DROP TABLE "image_embeddings";

-- CreateIndex
CREATE INDEX "documents_workspaceId_createdAt_idx" ON "documents"("workspaceId", "createdAt");
