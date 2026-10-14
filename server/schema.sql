CREATE DATABASE IF NOT EXISTS biomedical_equipment
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE biomedical_equipment;

CREATE TABLE IF NOT EXISTS equipment (
  id INT AUTO_INCREMENT PRIMARY KEY,
  asset_tag VARCHAR(50) NOT NULL,
  equipment_name VARCHAR(100) NOT NULL,
  category ENUM(
    'Patient Monitor',
    'Infusion Pump',
    'Ventilator',
    'Defibrillator',
    'Diagnostic Imaging',
    'Laboratory Analyzer',
    'Other'
  ) NOT NULL,
  manufacturer VARCHAR(100) NOT NULL,
  model_number VARCHAR(100) NOT NULL,
  serial_number VARCHAR(100) NOT NULL,
  department VARCHAR(100) NOT NULL,
  operational_status ENUM(
    'In Service',
    'In Repair',
    'Out of Service',
    'Decommissioned'
  ) NOT NULL DEFAULT 'In Service',
  pm_interval ENUM('Monthly', 'Quarterly', 'Semi-Annual', 'Annual') NULL,
  purchase_date DATE NULL,
  last_maintenance_date DATE NULL,
  next_maintenance_date DATE NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_equipment_asset_tag (asset_tag),
  UNIQUE KEY uq_equipment_serial_number (serial_number),
  KEY idx_equipment_next_maintenance (next_maintenance_date)
) ENGINE=InnoDB;

ALTER TABLE equipment
  MODIFY category ENUM(
    'Patient Monitor',
    'Infusion Pump',
    'Ventilator',
    'Defibrillator',
    'Imaging',
    'Diagnostic Imaging',
    'Laboratory',
    'Laboratory Analyzer',
    'Other'
  ) NOT NULL,
  MODIFY operational_status ENUM(
    'In Service',
    'Under Maintenance',
    'In Repair',
    'Out of Service',
    'Retired',
    'Decommissioned'
  ) NOT NULL DEFAULT 'In Service';

UPDATE equipment SET category = 'Diagnostic Imaging' WHERE category = 'Imaging';
UPDATE equipment SET category = 'Laboratory Analyzer' WHERE category = 'Laboratory';
UPDATE equipment SET operational_status = 'In Repair' WHERE operational_status = 'Under Maintenance';
UPDATE equipment SET operational_status = 'Decommissioned' WHERE operational_status = 'Retired';

ALTER TABLE equipment
  MODIFY category ENUM(
    'Patient Monitor',
    'Infusion Pump',
    'Ventilator',
    'Defibrillator',
    'Diagnostic Imaging',
    'Laboratory Analyzer',
    'Other'
  ) NOT NULL,
  MODIFY operational_status ENUM(
    'In Service',
    'In Repair',
    'Out of Service',
    'Decommissioned'
  ) NOT NULL DEFAULT 'In Service';

SET @add_pm_interval = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE equipment ADD COLUMN pm_interval ENUM(''Monthly'', ''Quarterly'', ''Semi-Annual'', ''Annual'') NULL AFTER operational_status',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'equipment'
    AND COLUMN_NAME = 'pm_interval'
);
PREPARE add_pm_interval_stmt FROM @add_pm_interval;
EXECUTE add_pm_interval_stmt;
DEALLOCATE PREPARE add_pm_interval_stmt;

INSERT IGNORE INTO equipment (
  asset_tag,
  equipment_name,
  category,
  manufacturer,
  model_number,
  serial_number,
  department,
  operational_status,
  purchase_date,
  last_maintenance_date,
  next_maintenance_date,
  notes
) VALUES
  (
    'PM-001',
    'Patient Monitor',
    'Patient Monitor',
    'Philips',
    'MX450',
    'SN-PM-10001',
    'ICU',
    'In Service',
    DATE_SUB(CURDATE(), INTERVAL 400 DAY),
    DATE_SUB(CURDATE(), INTERVAL 170 DAY),
    DATE_ADD(CURDATE(), INTERVAL 14 DAY),
    'Physiological monitor assigned to ICU bed 3'
  ),
  (
    'IP-014',
    'Infusion Pump',
    'Infusion Pump',
    'Baxter',
    'Sigma Spectrum',
    'SN-IP-10014',
    'Emergency Department',
    'In Service',
    DATE_SUB(CURDATE(), INTERVAL 800 DAY),
    DATE_SUB(CURDATE(), INTERVAL 200 DAY),
    DATE_SUB(CURDATE(), INTERVAL 5 DAY),
    'PM overdue. Flow sensor needs verification.'
  ),
  (
    'VN-208',
    'Ventilator',
    'Ventilator',
    'Medtronic',
    'Puritan Bennett 980',
    'SN-VN-10208',
    'ICU',
    'In Service',
    DATE_SUB(CURDATE(), INTERVAL 600 DAY),
    DATE_SUB(CURDATE(), INTERVAL 20 DAY),
    DATE_ADD(CURDATE(), INTERVAL 90 DAY),
    'Critical-care ventilator. PM current.'
  ),
  (
    'DF-033',
    'Defibrillator',
    'Defibrillator',
    'Zoll',
    'R Series',
    'SN-DF-10033',
    'Radiology',
    'In Repair',
    DATE_SUB(CURDATE(), INTERVAL 300 DAY),
    DATE_SUB(CURDATE(), INTERVAL 40 DAY),
    NULL,
    'In repair awaiting parts. PM not scheduled.'
  ),
  (
    'IMG-017',
    'Portable X-ray',
    'Diagnostic Imaging',
    'GE HealthCare',
    'AMX Navigate',
    'SN-IMG-10017',
    'Radiology',
    'Out of Service',
    DATE_SUB(CURDATE(), INTERVAL 900 DAY),
    DATE_SUB(CURDATE(), INTERVAL 80 DAY),
    DATE_SUB(CURDATE(), INTERVAL 10 DAY),
    'Out of service. Awaiting X-ray tube replacement.'
  );

UPDATE equipment SET department = 'Emergency Department', notes = 'PM overdue. Flow sensor needs verification.' WHERE asset_tag = 'IP-014';
UPDATE equipment SET department = 'ICU', notes = 'Critical-care ventilator. PM current.' WHERE asset_tag = 'VN-208';
UPDATE equipment SET notes = 'Physiological monitor assigned to ICU bed 3' WHERE asset_tag = 'PM-001';
UPDATE equipment SET notes = 'In repair awaiting parts. PM not scheduled.' WHERE asset_tag = 'DF-033';
UPDATE equipment SET category = 'Diagnostic Imaging', notes = 'Out of service. Awaiting X-ray tube replacement.' WHERE asset_tag = 'IMG-017';
UPDATE equipment SET pm_interval = 'Semi-Annual' WHERE asset_tag = 'PM-001' AND pm_interval IS NULL;
UPDATE equipment SET pm_interval = 'Quarterly' WHERE asset_tag = 'IP-014' AND pm_interval IS NULL;
UPDATE equipment SET pm_interval = 'Semi-Annual' WHERE asset_tag = 'VN-208' AND pm_interval IS NULL;
UPDATE equipment SET pm_interval = 'Annual' WHERE asset_tag = 'DF-033' AND pm_interval IS NULL;
UPDATE equipment SET pm_interval = 'Annual' WHERE asset_tag = 'IMG-017' AND pm_interval IS NULL;

CREATE TABLE IF NOT EXISTS maintenance_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  equipment_id INT NOT NULL,
  maintenance_type ENUM(
    'Preventive Maintenance',
    'Corrective Maintenance',
    'Incoming Inspection',
    'Electrical Safety Test',
    'Calibration',
    'Asset Registration',
    'Operational Status Change',
    'PM Schedule Change'
  ) NOT NULL,
  maintenance_date DATE NOT NULL,
  performed_by VARCHAR(100) NULL,
  performed_by_type ENUM('In-House Engineer', 'Supplier Engineer') NULL,
  operational_status ENUM('In Service', 'In Repair', 'Out of Service', 'Decommissioned') NULL,
  remarks VARCHAR(1000) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_maintenance_history_equipment
    FOREIGN KEY (equipment_id) REFERENCES equipment(id)
    ON DELETE RESTRICT,
  KEY idx_maintenance_history_equipment_date (equipment_id, maintenance_date)
) ENGINE=InnoDB;

SET @add_performed_by = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE maintenance_history ADD COLUMN performed_by VARCHAR(100) NULL AFTER maintenance_date',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'maintenance_history'
    AND COLUMN_NAME = 'performed_by'
);
PREPARE add_performed_by_stmt FROM @add_performed_by;
EXECUTE add_performed_by_stmt;
DEALLOCATE PREPARE add_performed_by_stmt;

SET @add_performed_by_type = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE maintenance_history ADD COLUMN performed_by_type ENUM(''In-House Engineer'', ''Supplier Engineer'') NULL AFTER performed_by',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'maintenance_history'
    AND COLUMN_NAME = 'performed_by_type'
);
PREPARE add_performed_by_type_stmt FROM @add_performed_by_type;
EXECUTE add_performed_by_type_stmt;
DEALLOCATE PREPARE add_performed_by_type_stmt;

SET @add_history_status = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE maintenance_history ADD COLUMN operational_status ENUM(''In Service'', ''In Repair'', ''Out of Service'', ''Decommissioned'') NULL AFTER performed_by_type',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'maintenance_history'
    AND COLUMN_NAME = 'operational_status'
);
PREPARE add_history_status_stmt FROM @add_history_status;
EXECUTE add_history_status_stmt;
DEALLOCATE PREPARE add_history_status_stmt;

ALTER TABLE maintenance_history
  MODIFY maintenance_type ENUM(
    'Preventive',
    'Corrective',
    'Inspection',
    'Calibration',
    'Preventive Maintenance',
    'Corrective Maintenance',
    'Incoming Inspection',
    'Electrical Safety Test',
    'Asset Registration',
    'Operational Status Change',
    'PM Schedule Change'
  ) NOT NULL;

UPDATE maintenance_history SET maintenance_type = 'Preventive Maintenance' WHERE maintenance_type = 'Preventive';
UPDATE maintenance_history SET maintenance_type = 'Corrective Maintenance' WHERE maintenance_type = 'Corrective';
UPDATE maintenance_history SET maintenance_type = 'Incoming Inspection' WHERE maintenance_type = 'Inspection';

UPDATE maintenance_history SET remarks = 'Incoming inspection completed before the device was placed in service.' WHERE remarks = 'Incoming inspection after installation';
UPDATE maintenance_history SET remarks = 'PM completed. Battery replaced and ECG leads verified.' WHERE remarks = 'Replaced battery and verified leads';
UPDATE maintenance_history SET remarks = 'CM completed. Occlusion alarm cleared and flow sensor verified.' WHERE remarks = 'Cleared occlusion alarm and recalibrated flow';
UPDATE maintenance_history SET remarks = 'PM completed. Circuit test and alarm check passed.' WHERE remarks = 'Completed ventilator preventive maintenance';
UPDATE maintenance_history SET remarks = 'CM in progress. Awaiting parts. PM not scheduled.' WHERE remarks = 'Repair started; next date not scheduled yet';
UPDATE maintenance_history
SET maintenance_type = 'Corrective Maintenance',
    remarks = 'CM. Image-quality check failed. Awaiting tube replacement.'
WHERE remarks = 'Failed image-quality check; waiting on a part';

ALTER TABLE maintenance_history
  MODIFY maintenance_type ENUM(
    'Preventive Maintenance',
    'Corrective Maintenance',
    'Incoming Inspection',
    'Electrical Safety Test',
    'Calibration',
    'Asset Registration',
    'Operational Status Change',
    'PM Schedule Change'
  ) NOT NULL;

INSERT INTO maintenance_history (equipment_id, maintenance_type, maintenance_date, performed_by, performed_by_type, remarks)
SELECT e.id, 'Incoming Inspection', DATE_SUB(CURDATE(), INTERVAL 300 DAY), 'M. Santos', 'In-House Engineer', 'Incoming inspection completed before the device was placed in service.'
FROM equipment e
WHERE e.asset_tag = 'PM-001'
  AND NOT EXISTS (
    SELECT 1 FROM maintenance_history h
    WHERE h.equipment_id = e.id AND h.remarks = 'Incoming inspection completed before the device was placed in service.'
  );

INSERT INTO maintenance_history (equipment_id, maintenance_type, maintenance_date, performed_by, performed_by_type, remarks)
SELECT e.id, 'Preventive Maintenance', DATE_SUB(CURDATE(), INTERVAL 170 DAY), 'J. Cruz', 'In-House Engineer', 'PM completed. Battery replaced and ECG leads verified.'
FROM equipment e
WHERE e.asset_tag = 'PM-001'
  AND NOT EXISTS (
    SELECT 1 FROM maintenance_history h
    WHERE h.equipment_id = e.id AND h.remarks = 'PM completed. Battery replaced and ECG leads verified.'
  );

INSERT INTO maintenance_history (equipment_id, maintenance_type, maintenance_date, performed_by, performed_by_type, remarks)
SELECT e.id, 'Corrective Maintenance', DATE_SUB(CURDATE(), INTERVAL 200 DAY), 'P. Garcia', 'Supplier Engineer', 'CM completed. Occlusion alarm cleared and flow sensor verified.'
FROM equipment e
WHERE e.asset_tag = 'IP-014'
  AND NOT EXISTS (
    SELECT 1 FROM maintenance_history h
    WHERE h.equipment_id = e.id AND h.remarks = 'CM completed. Occlusion alarm cleared and flow sensor verified.'
  );

INSERT INTO maintenance_history (equipment_id, maintenance_type, maintenance_date, performed_by, performed_by_type, remarks)
SELECT e.id, 'Preventive Maintenance', DATE_SUB(CURDATE(), INTERVAL 20 DAY), 'M. Santos', 'In-House Engineer', 'PM completed. Circuit test and alarm check passed.'
FROM equipment e
WHERE e.asset_tag = 'VN-208'
  AND NOT EXISTS (
    SELECT 1 FROM maintenance_history h
    WHERE h.equipment_id = e.id AND h.remarks = 'PM completed. Circuit test and alarm check passed.'
  );

INSERT INTO maintenance_history (equipment_id, maintenance_type, maintenance_date, performed_by, performed_by_type, remarks)
SELECT e.id, 'Corrective Maintenance', DATE_SUB(CURDATE(), INTERVAL 40 DAY), 'A. Bautista', 'In-House Engineer', 'CM in progress. Awaiting parts. PM not scheduled.'
FROM equipment e
WHERE e.asset_tag = 'DF-033'
  AND NOT EXISTS (
    SELECT 1 FROM maintenance_history h
    WHERE h.equipment_id = e.id AND h.remarks = 'CM in progress. Awaiting parts. PM not scheduled.'
  );

INSERT INTO maintenance_history (equipment_id, maintenance_type, maintenance_date, performed_by, performed_by_type, remarks)
SELECT e.id, 'Corrective Maintenance', DATE_SUB(CURDATE(), INTERVAL 80 DAY), 'P. Garcia', 'Supplier Engineer', 'CM. Image-quality check failed. Awaiting tube replacement.'
FROM equipment e
WHERE e.asset_tag = 'IMG-017'
  AND NOT EXISTS (
    SELECT 1 FROM maintenance_history h
    WHERE h.equipment_id = e.id AND h.remarks = 'CM. Image-quality check failed. Awaiting tube replacement.'
  );

UPDATE maintenance_history SET performed_by = 'M. Santos' WHERE performed_by = 'Ana Reyes';
UPDATE maintenance_history SET performed_by = 'J. Cruz' WHERE performed_by = 'James Okonkwo';
UPDATE maintenance_history SET performed_by = 'P. Garcia' WHERE performed_by = 'Dana Brooks';
UPDATE maintenance_history SET performed_by = 'A. Bautista' WHERE performed_by = 'Luis Ortega';
UPDATE maintenance_history SET performed_by = 'M. Santos', performed_by_type = 'In-House Engineer' WHERE remarks = 'Incoming inspection completed before the device was placed in service.' AND performed_by IS NULL;
UPDATE maintenance_history SET performed_by = 'J. Cruz', performed_by_type = 'In-House Engineer' WHERE remarks = 'PM completed. Battery replaced and ECG leads verified.' AND performed_by IS NULL;
UPDATE maintenance_history SET performed_by = 'P. Garcia', performed_by_type = 'Supplier Engineer' WHERE remarks = 'CM completed. Occlusion alarm cleared and flow sensor verified.' AND performed_by IS NULL;
UPDATE maintenance_history SET performed_by = 'M. Santos', performed_by_type = 'In-House Engineer' WHERE remarks = 'PM completed. Circuit test and alarm check passed.' AND performed_by IS NULL;
UPDATE maintenance_history SET performed_by = 'A. Bautista', performed_by_type = 'In-House Engineer' WHERE remarks = 'CM in progress. Awaiting parts. PM not scheduled.' AND performed_by IS NULL;
UPDATE maintenance_history SET operational_status = 'In Repair' WHERE remarks = 'CM in progress. Awaiting parts. PM not scheduled.' AND operational_status IS NULL;
UPDATE maintenance_history SET performed_by = 'P. Garcia', performed_by_type = 'Supplier Engineer' WHERE remarks = 'CM. Image-quality check failed. Awaiting tube replacement.' AND performed_by IS NULL;

SET @drop_cascade_fk = (
  SELECT IF(
    COUNT(*) > 0,
    'ALTER TABLE maintenance_history DROP FOREIGN KEY fk_maintenance_history_equipment',
    'SELECT 1'
  )
  FROM information_schema.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'maintenance_history'
    AND CONSTRAINT_NAME = 'fk_maintenance_history_equipment'
    AND DELETE_RULE = 'CASCADE'
);
PREPARE drop_cascade_fk_stmt FROM @drop_cascade_fk;
EXECUTE drop_cascade_fk_stmt;
DEALLOCATE PREPARE drop_cascade_fk_stmt;

SET @add_restrict_fk = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE maintenance_history ADD CONSTRAINT fk_maintenance_history_equipment FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE RESTRICT',
    'SELECT 1'
  )
  FROM information_schema.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'maintenance_history'
    AND CONSTRAINT_NAME = 'fk_maintenance_history_equipment'
);
PREPARE add_restrict_fk_stmt FROM @add_restrict_fk;
EXECUTE add_restrict_fk_stmt;
DEALLOCATE PREPARE add_restrict_fk_stmt;

UPDATE maintenance_history h
JOIN equipment e ON e.id = h.equipment_id
SET h.remarks = CONCAT('Record created for ', e.asset_tag, '.')
WHERE h.maintenance_type = 'Asset Registration'
  AND h.remarks LIKE 'Device record opened%';

INSERT INTO maintenance_history (equipment_id, maintenance_type, maintenance_date, remarks)
SELECT e.id, 'Asset Registration', COALESCE(e.purchase_date, CURDATE()),
  CONCAT('Record created for ', e.asset_tag, '.')
FROM equipment e
WHERE NOT EXISTS (
  SELECT 1 FROM maintenance_history h
  WHERE h.equipment_id = e.id AND h.maintenance_type = 'Asset Registration'
);

CREATE TABLE IF NOT EXISTS service_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  equipment_id INT NOT NULL,
  request_number VARCHAR(20) NOT NULL,
  reported_by VARCHAR(100) NOT NULL,
  priority ENUM('Low', 'Medium', 'High') NOT NULL,
  problem VARCHAR(1000) NOT NULL,
  status ENUM('Open', 'In Progress', 'Waiting for Parts', 'Completed', 'Cancelled') NOT NULL DEFAULT 'Open',
  opened_on DATE NOT NULL,
  closed_on DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_service_requests_number (request_number),
  KEY idx_service_requests_status_opened (status, opened_on),
  KEY idx_service_requests_equipment (equipment_id),
  CONSTRAINT fk_service_requests_equipment
    FOREIGN KEY (equipment_id) REFERENCES equipment(id)
    ON DELETE RESTRICT
) ENGINE=InnoDB;

INSERT INTO service_requests (
  equipment_id, request_number, reported_by, priority, problem, status, opened_on, closed_on
)
SELECT e.id, 'SR-1001', 'ED Nursing', 'High',
  'Occlusion alarm keeps returning after the last corrective visit.',
  'Open', DATE_SUB(CURDATE(), INTERVAL 2 DAY), NULL
FROM equipment e
WHERE e.asset_tag = 'IP-014'
  AND NOT EXISTS (SELECT 1 FROM service_requests r WHERE r.request_number = 'SR-1001');

INSERT INTO service_requests (
  equipment_id, request_number, reported_by, priority, problem, status, opened_on, closed_on
)
SELECT e.id, 'SR-1002', 'Radiology Staff', 'Medium',
  'Defibrillator remains in repair while parts are on order.',
  'Waiting for Parts', DATE_SUB(CURDATE(), INTERVAL 6 DAY), NULL
FROM equipment e
WHERE e.asset_tag = 'DF-033'
  AND NOT EXISTS (SELECT 1 FROM service_requests r WHERE r.request_number = 'SR-1002');

INSERT INTO service_requests (
  equipment_id, request_number, reported_by, priority, problem, status, opened_on, closed_on
)
SELECT e.id, 'SR-1003', 'ICU Nursing', 'Low',
  'Alarm check requested after the last preventive maintenance.',
  'Completed', DATE_SUB(CURDATE(), INTERVAL 4 DAY), CURDATE()
FROM equipment e
WHERE e.asset_tag = 'VN-208'
  AND NOT EXISTS (SELECT 1 FROM service_requests r WHERE r.request_number = 'SR-1003');
