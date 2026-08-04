-- CreateEnum
CREATE TYPE "RoleName" AS ENUM ('GOD', 'ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "UiScope" AS ENUM ('EDITABLE', 'VISIBLE', 'INVISIBLE');

-- CreateEnum
CREATE TYPE "ValueType" AS ENUM ('float', 'integer', 'string', 'boolean', 'json');

-- CreateEnum
CREATE TYPE "Level" AS ENUM ('INFO', 'WARNING', 'ERROR');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('M', 'F', 'OTHER');

-- CreateEnum
CREATE TYPE "PersonType" AS ENUM ('USER');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "wsCode" TEXT,
    "avatarUrl" TEXT,
    "note" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "activatedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "logoFileId" INTEGER,
    "personId" INTEGER NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermissionConfig" (
    "id" SERIAL NOT NULL,
    "roleName" "RoleName" NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "scope" TEXT NOT NULL,

    CONSTRAINT "PermissionConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HiddenComponentConfig" (
    "id" SERIAL NOT NULL,
    "roleName" "RoleName" NOT NULL,
    "context" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "component" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HiddenComponentConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "name" "RoleName" NOT NULL,
    "label" TEXT,
    "rank" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "RoleToUser" (
    "id" SERIAL NOT NULL,
    "roleName" "RoleName" NOT NULL,
    "userId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleToUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Log" (
    "id" SERIAL NOT NULL,
    "level" "Level" NOT NULL DEFAULT 'INFO',
    "description" TEXT,
    "entityId" INTEGER,
    "entityName" TEXT,
    "input" JSONB,
    "output" JSONB,
    "toRoles" "RoleName"[] DEFAULT ARRAY['ADMIN', 'USER']::"RoleName"[],
    "actionByUsername" TEXT,
    "actionById" INTEGER,
    "isNotification" BOOLEAN DEFAULT false,
    "hasError" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recipients" JSONB,

    CONSTRAINT "Log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Config" (
    "name" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "uiScope" "UiScope" NOT NULL DEFAULT 'INVISIBLE',
    "type" "ValueType" NOT NULL DEFAULT 'boolean',
    "boolean" BOOLEAN,
    "integer" INTEGER,
    "float" DOUBLE PRECISION,
    "string" TEXT,
    "json" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Config_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "surname" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3),
    "fiscalCode" TEXT,
    "vatNumber" TEXT,
    "gender" "Gender",
    "personType" "PersonType" NOT NULL,
    "note" TEXT,
    "avatarUrl" TEXT,
    "bornIn" TEXT,
    "livesIn" TEXT,
    "contactId" INTEGER NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "note" TEXT,
    "telephone" TEXT,
    "pec" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Address" (
    "id" SERIAL NOT NULL,
    "country" TEXT,
    "state" TEXT,
    "province" TEXT,
    "city" TEXT,
    "zipCode" TEXT,
    "address" TEXT,
    "number" TEXT,
    "note" TEXT,
    "default" BOOLEAN DEFAULT false,
    "billing" BOOLEAN DEFAULT false,
    "personId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "File" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonFile" (
    "personId" INTEGER NOT NULL,
    "fileId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonFile_pkey" PRIMARY KEY ("personId","fileId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_personId_key" ON "User"("personId");

-- CreateIndex
CREATE INDEX "PermissionConfig_action_entity_scope_idx" ON "PermissionConfig"("action", "entity", "scope");

-- CreateIndex
CREATE UNIQUE INDEX "PermissionConfig_action_entity_scope_roleName_key" ON "PermissionConfig"("action", "entity", "scope", "roleName");

-- CreateIndex
CREATE INDEX "HiddenComponentConfig_context_section_component_idx" ON "HiddenComponentConfig"("context", "section", "component");

-- CreateIndex
CREATE UNIQUE INDEX "HiddenComponentConfig_context_section_component_roleName_key" ON "HiddenComponentConfig"("context", "section", "component", "roleName");

-- CreateIndex
CREATE UNIQUE INDEX "RoleToUser_roleName_userId_key" ON "RoleToUser"("roleName", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Person_contactId_key" ON "Person"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_email_key" ON "Contact"("email");

-- CreateIndex
CREATE UNIQUE INDEX "File_url_key" ON "File"("url");

-- CreateIndex
CREATE INDEX "PersonFile_fileId_idx" ON "PersonFile"("fileId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_logoFileId_fkey" FOREIGN KEY ("logoFileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionConfig" ADD CONSTRAINT "PermissionConfig_roleName_fkey" FOREIGN KEY ("roleName") REFERENCES "Role"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiddenComponentConfig" ADD CONSTRAINT "HiddenComponentConfig_roleName_fkey" FOREIGN KEY ("roleName") REFERENCES "Role"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleToUser" ADD CONSTRAINT "RoleToUser_roleName_fkey" FOREIGN KEY ("roleName") REFERENCES "Role"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleToUser" ADD CONSTRAINT "RoleToUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Log" ADD CONSTRAINT "Log_actionById_fkey" FOREIGN KEY ("actionById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonFile" ADD CONSTRAINT "PersonFile_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonFile" ADD CONSTRAINT "PersonFile_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;
