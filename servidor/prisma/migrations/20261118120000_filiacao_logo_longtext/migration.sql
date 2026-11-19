-- AlterTable: logo da liga (data URI base64) excede TEXT (64KB) → LONGTEXT.
ALTER TABLE `filiacao_config` MODIFY `logoUrl` LONGTEXT NULL;
