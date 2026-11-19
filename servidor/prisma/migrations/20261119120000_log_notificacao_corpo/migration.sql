-- AlterTable: guarda o corpo efetivamente enviado (auditoria do push/WhatsApp de reconquista).
ALTER TABLE `logs_notificacao` ADD COLUMN `corpo` TEXT NULL;
