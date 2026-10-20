-- Disaster Resource Management System
-- MySQL 8.0.16+ / MySQL Workbench compatible
-- Run this entire script in MySQL Workbench.
-- WARNING: The DROP TABLE statements below remove existing tables with these names.
-- Back up any existing data before running this script.

CREATE DATABASE IF NOT EXISTS disaster_resource_management
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE disaster_resource_management;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS emergency_alert_notifications;
DROP TABLE IF EXISTS emergency_alerts;
DROP TABLE IF EXISTS request_routing_log;
DROP TABLE IF EXISTS sos_requests;
DROP TABLE IF EXISTS disaster_events;
DROP TABLE IF EXISTS inventory_transactions;
DROP TABLE IF EXISTS inventory_items;
DROP TABLE IF EXISTS shelter_facilities;
DROP TABLE IF EXISTS admin_profiles;
DROP TABLE IF EXISTS shelter_profiles;
DROP TABLE IF EXISTS victim_profiles;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. USERS
CREATE TABLE users (
    user_id BIGINT NOT NULL AUTO_INCREMENT,
    email VARCHAR(150) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    role VARCHAR(20) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_known_lat DECIMAL(9,6) NULL,
    last_known_lng DECIMAL(9,6) NULL,
    last_location_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    UNIQUE KEY uq_users_email (email),
    UNIQUE KEY uq_users_phone (phone),
    KEY idx_users_role (role),
    CONSTRAINT chk_users_role CHECK (role IN ('VICTIM','SHELTER','ADMIN'))
) ENGINE=InnoDB;

-- 2. VICTIM PROFILES
CREATE TABLE victim_profiles (
    victim_id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    family_size INT NOT NULL DEFAULT 1,
    address VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (victim_id),
    UNIQUE KEY uq_victim_user (user_id),
    CONSTRAINT chk_victim_family_size CHECK (family_size >= 1),
    CONSTRAINT fk_victim_user FOREIGN KEY (user_id) REFERENCES users(user_id)
) ENGINE=InnoDB;

-- 3. SHELTER PROFILES
CREATE TABLE shelter_profiles (
    shelter_id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    shelter_name VARCHAR(150) NOT NULL,
    organisation_name VARCHAR(150) NULL,
    address VARCHAR(255) NOT NULL,
    latitude DECIMAL(9,6) NOT NULL,
    longitude DECIMAL(9,6) NOT NULL,
    contact_number VARCHAR(20) NOT NULL,
    capacity INT NOT NULL,
    current_occupancy INT NOT NULL DEFAULT 0,
    verification_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    operational_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (shelter_id),
    UNIQUE KEY uq_shelter_user (user_id),
    KEY idx_shelter_lat_lng (latitude, longitude),
    KEY idx_shelter_status (verification_status, operational_status),
    CONSTRAINT chk_shelter_capacity CHECK (capacity >= 0),
    CONSTRAINT chk_shelter_occupancy_nonnegative CHECK (current_occupancy >= 0),
    CONSTRAINT chk_shelter_occupancy_capacity CHECK (current_occupancy <= capacity),
    CONSTRAINT chk_shelter_verification CHECK (verification_status IN ('PENDING','VERIFIED','REJECTED')),
    CONSTRAINT chk_shelter_operational CHECK (operational_status IN ('ACTIVE','INACTIVE')),
    CONSTRAINT fk_shelter_user FOREIGN KEY (user_id) REFERENCES users(user_id)
) ENGINE=InnoDB;

-- 4. ADMIN PROFILES
CREATE TABLE admin_profiles (
    admin_id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    department VARCHAR(100) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (admin_id),
    UNIQUE KEY uq_admin_user (user_id),
    CONSTRAINT fk_admin_user FOREIGN KEY (user_id) REFERENCES users(user_id)
) ENGINE=InnoDB;

-- 5. SHELTER FACILITIES
CREATE TABLE shelter_facilities (
    facility_id BIGINT NOT NULL AUTO_INCREMENT,
    shelter_id BIGINT NOT NULL,
    facility_type VARCHAR(20) NOT NULL,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    notes VARCHAR(255) NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (facility_id),
    UNIQUE KEY uq_shelter_facility_type (shelter_id, facility_type),
    CONSTRAINT chk_facility_type CHECK (facility_type IN
      ('FOOD','WATER','MEDICAL','ACCOMMODATION','SANITATION','ELECTRICITY','OTHER')),
    CONSTRAINT fk_facility_shelter FOREIGN KEY (shelter_id) REFERENCES shelter_profiles(shelter_id)
) ENGINE=InnoDB;

-- 6. INVENTORY ITEMS
CREATE TABLE inventory_items (
    item_id BIGINT NOT NULL AUTO_INCREMENT,
    shelter_id BIGINT NOT NULL,
    resource_name VARCHAR(100) NOT NULL,
    category VARCHAR(20) NOT NULL,
    quantity INT NOT NULL DEFAULT 0,
    unit VARCHAR(20) NOT NULL,
    low_stock_threshold INT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'OK',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (item_id),
    UNIQUE KEY uq_shelter_resource (shelter_id, resource_name),
    KEY idx_inventory_status (shelter_id, status),
    CONSTRAINT chk_inventory_category CHECK (category IN
      ('FOOD','WATER','MEDICINE','BLANKETS','RESCUE_EQUIPMENT','OTHER')),
    CONSTRAINT chk_inventory_quantity CHECK (quantity >= 0),
    CONSTRAINT chk_inventory_threshold CHECK (low_stock_threshold >= 0),
    CONSTRAINT chk_inventory_status CHECK (status IN ('OK','LOW_STOCK','OUT_OF_STOCK')),
    CONSTRAINT fk_inventory_shelter FOREIGN KEY (shelter_id) REFERENCES shelter_profiles(shelter_id)
) ENGINE=InnoDB;

-- 7. INVENTORY TRANSACTIONS
CREATE TABLE inventory_transactions (
    transaction_id BIGINT NOT NULL AUTO_INCREMENT,
    item_id BIGINT NOT NULL,
    change_type VARCHAR(20) NOT NULL,
    quantity_change INT NOT NULL,
    resulting_quantity INT NOT NULL,
    performed_by BIGINT NULL,
    remarks VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (transaction_id),
    KEY idx_inv_txn_item (item_id, created_at),
    CONSTRAINT chk_inventory_change_type CHECK (change_type IN ('RESTOCK','CONSUMPTION','ADJUSTMENT','DAMAGE')),
    CONSTRAINT chk_inventory_resulting_quantity CHECK (resulting_quantity >= 0),
    CONSTRAINT fk_transaction_item FOREIGN KEY (item_id) REFERENCES inventory_items(item_id),
    CONSTRAINT fk_transaction_user FOREIGN KEY (performed_by) REFERENCES users(user_id)
) ENGINE=InnoDB;

-- 8. DISASTER EVENTS
CREATE TABLE disaster_events (
    disaster_id BIGINT NOT NULL AUTO_INCREMENT,
    name VARCHAR(150) NOT NULL,
    disaster_type VARCHAR(20) NOT NULL,
    description TEXT NULL,
    severity VARCHAR(20) NOT NULL,
    affected_area VARCHAR(255) NULL,
    center_lat DECIMAL(9,6) NULL,
    center_lng DECIMAL(9,6) NULL,
    radius_km DECIMAL(6,2) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    start_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP NULL,
    created_by BIGINT NOT NULL,
    PRIMARY KEY (disaster_id),
    CONSTRAINT chk_disaster_type CHECK (disaster_type IN ('FLOOD','EARTHQUAKE','CYCLONE','FIRE','LANDSLIDE','OTHER')),
    CONSTRAINT chk_disaster_severity CHECK (severity IN ('LOW','MODERATE','HIGH','CRITICAL')),
    CONSTRAINT chk_disaster_status CHECK (status IN ('ACTIVE','RESOLVED')),
    CONSTRAINT chk_disaster_radius CHECK (radius_km IS NULL OR radius_km >= 0),
    CONSTRAINT fk_disaster_creator FOREIGN KEY (created_by) REFERENCES users(user_id)
) ENGINE=InnoDB;

-- 9. SOS REQUESTS
CREATE TABLE sos_requests (
    request_id BIGINT NOT NULL AUTO_INCREMENT,
    tracking_id VARCHAR(20) NOT NULL,
    victim_id BIGINT NOT NULL,
    disaster_id BIGINT NULL,
    category VARCHAR(20) NOT NULL,
    family_size INT NOT NULL,
    details TEXT NULL,
    latitude DECIMAL(9,6) NOT NULL,
    longitude DECIMAL(9,6) NOT NULL,
    used_last_known_location BOOLEAN NOT NULL DEFAULT FALSE,
    priority VARCHAR(10) NOT NULL DEFAULT 'NORMAL',
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    accepted_by_shelter_id BIGINT NULL,
    sync_status VARCHAR(15) NOT NULL DEFAULT 'SYNCED',
    client_created_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (request_id),
    UNIQUE KEY uq_sos_tracking (tracking_id),
    KEY idx_sos_status (status),
    KEY idx_sos_victim (victim_id),
    KEY idx_sos_lat_lng (latitude, longitude),
    CONSTRAINT chk_sos_category CHECK (category IN ('FOOD','WATER','MEDICAL','RESCUE','SHELTER','OTHER')),
    CONSTRAINT chk_sos_family_size CHECK (family_size >= 1),
    CONSTRAINT chk_sos_priority CHECK (priority IN ('LOW','NORMAL','HIGH','CRITICAL')),
    CONSTRAINT chk_sos_status CHECK (status IN ('PENDING','FORWARDED','ACCEPTED','UNRESOLVED','CANCELLED')),
    CONSTRAINT chk_sos_sync_status CHECK (sync_status IN ('SYNCED','PENDING_SYNC','CONFLICT')),
    CONSTRAINT fk_sos_victim FOREIGN KEY (victim_id) REFERENCES victim_profiles(victim_id),
    CONSTRAINT fk_sos_disaster FOREIGN KEY (disaster_id) REFERENCES disaster_events(disaster_id),
    CONSTRAINT fk_sos_accepted_shelter FOREIGN KEY (accepted_by_shelter_id) REFERENCES shelter_profiles(shelter_id)
) ENGINE=InnoDB;

-- 10. REQUEST ROUTING LOG
CREATE TABLE request_routing_log (
    routing_id BIGINT NOT NULL AUTO_INCREMENT,
    request_id BIGINT NOT NULL,
    shelter_id BIGINT NOT NULL,
    sequence_number INT NOT NULL,
    distance_km DECIMAL(6,2) NOT NULL,
    notified_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP NULL,
    response VARCHAR(15) NOT NULL DEFAULT 'PENDING',
    rejection_reason VARCHAR(255) NULL,
    PRIMARY KEY (routing_id),
    UNIQUE KEY uq_routing_sequence (request_id, sequence_number),
    UNIQUE KEY uq_routing_request_shelter (request_id, shelter_id),
    KEY idx_routing_request (request_id, sequence_number),
    CONSTRAINT chk_routing_sequence CHECK (sequence_number >= 1),
    CONSTRAINT chk_routing_distance CHECK (distance_km >= 0),
    CONSTRAINT chk_routing_response CHECK (response IN ('PENDING','ACCEPTED','REJECTED','TIMED_OUT')),
    CONSTRAINT fk_routing_request FOREIGN KEY (request_id) REFERENCES sos_requests(request_id),
    CONSTRAINT fk_routing_shelter FOREIGN KEY (shelter_id) REFERENCES shelter_profiles(shelter_id)
) ENGINE=InnoDB;

-- 11. EMERGENCY ALERTS
CREATE TABLE emergency_alerts (
    alert_id BIGINT NOT NULL AUTO_INCREMENT,
    victim_id BIGINT NOT NULL,
    disaster_id BIGINT NULL,
    alert_type VARCHAR(30) NOT NULL DEFAULT 'GENERAL',
    latitude DECIMAL(9,6) NOT NULL,
    longitude DECIMAL(9,6) NOT NULL,
    used_last_known_location BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    sync_status VARCHAR(15) NOT NULL DEFAULT 'SYNCED',
    client_created_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL,
    PRIMARY KEY (alert_id),
    KEY idx_alert_status (status),
    KEY idx_alert_victim (victim_id),
    CONSTRAINT chk_alert_type CHECK (alert_type IN
      ('EARTHQUAKE_COLLAPSE','FIRE','ACCIDENT','MEDICAL','DANGER_KIDNAPPING','TRAPPED','LOST_CHILD','GENERAL')),
    CONSTRAINT chk_alert_status CHECK (status IN ('ACTIVE','ACKNOWLEDGED','RESOLVED')),
    CONSTRAINT chk_alert_sync_status CHECK (sync_status IN ('SYNCED','PENDING_SYNC')),
    CONSTRAINT fk_alert_victim FOREIGN KEY (victim_id) REFERENCES victim_profiles(victim_id),
    CONSTRAINT fk_alert_disaster FOREIGN KEY (disaster_id) REFERENCES disaster_events(disaster_id)
) ENGINE=InnoDB;

-- 12. EMERGENCY ALERT NOTIFICATIONS
CREATE TABLE emergency_alert_notifications (
    alert_notification_id BIGINT NOT NULL AUTO_INCREMENT,
    alert_id BIGINT NOT NULL,
    shelter_id BIGINT NULL,
    notified_admin BOOLEAN NOT NULL DEFAULT FALSE,
    distance_km DECIMAL(6,2) NULL,
    notified_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at TIMESTAMP NULL,
    PRIMARY KEY (alert_notification_id),
    UNIQUE KEY uq_alert_shelter (alert_id, shelter_id),
    CONSTRAINT chk_alert_notification_distance CHECK (distance_km IS NULL OR distance_km >= 0),
    CONSTRAINT fk_alert_notification_alert FOREIGN KEY (alert_id) REFERENCES emergency_alerts(alert_id),
    CONSTRAINT fk_alert_notification_shelter FOREIGN KEY (shelter_id) REFERENCES shelter_profiles(shelter_id)
) ENGINE=InnoDB;
-- MySQL permits multiple NULL values in a UNIQUE index. Therefore multiple admin-monitoring
-- rows with shelter_id=NULL are possible; the application should create only one if desired.

-- 13. NOTIFICATIONS
CREATE TABLE notifications (
    notification_id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    notification_type VARCHAR(30) NOT NULL,
    channel VARCHAR(10) NOT NULL DEFAULT 'IN_APP',
    related_entity_type VARCHAR(30) NULL,
    related_entity_id BIGINT NULL,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    delivery_status VARCHAR(15) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (notification_id),
    KEY idx_notif_user (user_id, is_read),
    KEY idx_notif_channel_status (channel, delivery_status),
    CONSTRAINT chk_notification_type CHECK (notification_type IN
      ('NEW_SOS','BUZZER_ALERT','REQUEST_RECEIVED','REQUEST_ACCEPTED','REQUEST_REJECTED',
       'REQUEST_FORWARDED','REQUEST_UNRESOLVED','LOW_INVENTORY','GOV_BROADCAST')),
    CONSTRAINT chk_notification_channel CHECK (channel IN ('IN_APP','EMAIL','SMS')),
    CONSTRAINT chk_notification_delivery CHECK (delivery_status IN ('PENDING','SENT','FAILED')),
    CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES users(user_id)
) ENGINE=InnoDB;

-- 14. AUDIT LOGS
CREATE TABLE audit_logs (
    log_id BIGINT NOT NULL AUTO_INCREMENT,
    actor_user_id BIGINT NULL,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(30) NOT NULL,
    entity_id BIGINT NOT NULL,
    details JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (log_id),
    KEY idx_audit_entity (entity_type, entity_id),
    KEY idx_audit_actor (actor_user_id, created_at),
    CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES users(user_id)
) ENGINE=InnoDB;

-- SAMPLE DATA
-- Demo password_hash values below are placeholders, not real production password hashes.
INSERT INTO users
    (user_id, email, phone, password_hash, full_name, role)
VALUES
    (1, 'anita@example.com', '9840011111', 'demo_hash_1', 'Anita Raman', 'VICTIM'),
    (2, 'redcross.chennai@example.com', '9840022222', 'demo_hash_2', 'Red Cross Chennai Admin', 'SHELTER'),
    (3, 'gov.admin@example.com', '9840033333', 'demo_hash_3', 'District Admin', 'ADMIN'),
    (4, 'community.shelter@example.com', '9840044444', 'demo_hash_4', 'Community Hall Admin', 'SHELTER');

INSERT INTO victim_profiles (victim_id, user_id, family_size, address)
VALUES (12, 1, 4, 'T Nagar, Chennai');

INSERT INTO shelter_profiles
    (shelter_id, user_id, shelter_name, organisation_name, address, latitude, longitude,
     contact_number, capacity, current_occupancy, verification_status, operational_status)
VALUES
    (7, 2, 'Red Cross Relief Center', 'Indian Red Cross', 'Anna Nagar, Chennai',
     13.085000, 80.210100, '04412345678', 200, 180, 'VERIFIED', 'ACTIVE'),
    (15, 4, 'Community Hall Shelter', 'City Corporation', 'Adyar, Chennai',
     13.006700, 80.257000, '04487654321', 150, 40, 'VERIFIED', 'ACTIVE');

INSERT INTO admin_profiles (admin_id, user_id, department)
VALUES (3, 3, 'District Disaster Management');

INSERT INTO shelter_facilities (shelter_id, facility_type, is_available)
VALUES
    (7, 'MEDICAL', TRUE),
    (7, 'FOOD', TRUE),
    (7, 'ACCOMMODATION', FALSE),
    (15, 'FOOD', TRUE),
    (15, 'WATER', TRUE),
    (15, 'ACCOMMODATION', TRUE);

INSERT INTO inventory_items
    (item_id, shelter_id, resource_name, category, quantity, unit, low_stock_threshold, status)
VALUES
    (101, 7, 'Insulin vials', 'MEDICINE', 8, 'vials', 10, 'LOW_STOCK'),
    (102, 15, 'Rice bags', 'FOOD', 300, 'kg', 50, 'OK');

INSERT INTO inventory_transactions
    (item_id, change_type, quantity_change, resulting_quantity, performed_by, remarks)
VALUES
    (101, 'RESTOCK', 8, 8, 2, 'Initial inventory record'),
    (102, 'RESTOCK', 300, 300, 4, 'Initial inventory record');

INSERT INTO disaster_events
    (disaster_id, name, disaster_type, description, severity, affected_area, status, created_by)
VALUES
    (3, 'Chennai Flood 2026', 'FLOOD',
     'Heavy monsoon flooding in northern Chennai', 'HIGH', 'Chennai North', 'ACTIVE', 3);

INSERT INTO sos_requests
    (request_id, tracking_id, victim_id, disaster_id, category, family_size, details,
     latitude, longitude, priority, status, accepted_by_shelter_id)
VALUES
    (501, 'SOS-8F3K2Q', 12, 3, 'MEDICAL', 4, 'Elderly member needs insulin',
     13.082700, 80.270700, 'HIGH', 'ACCEPTED', 15);

INSERT INTO request_routing_log
    (request_id, shelter_id, sequence_number, distance_km, notified_at, responded_at, response, rejection_reason)
VALUES
    (501, 7, 1, 2.35, '2026-08-26 09:00:00', '2026-08-26 09:03:00', 'REJECTED', 'At full capacity'),
    (501, 15, 2, 4.10, '2026-08-26 09:03:05', '2026-08-26 09:07:30', 'ACCEPTED', NULL);

INSERT INTO emergency_alerts
    (alert_id, victim_id, alert_type, latitude, longitude, used_last_known_location, status)
VALUES
    (88, 12, 'GENERAL', 13.082700, 80.270700, FALSE, 'ACTIVE');

-- Broadcast alert to nearby eligible shelters. LEAST/GREATEST clamps floating-point rounding.
INSERT INTO emergency_alert_notifications (alert_id, shelter_id, distance_km)
SELECT
    88,
    sp.shelter_id,
    ROUND(
      6371 * ACOS(LEAST(1.0, GREATEST(-1.0,
        COS(RADIANS(13.082700)) * COS(RADIANS(sp.latitude)) *
        COS(RADIANS(sp.longitude) - RADIANS(80.270700)) +
        SIN(RADIANS(13.082700)) * SIN(RADIANS(sp.latitude))
      ))),
      2
    )
FROM shelter_profiles AS sp
WHERE sp.verification_status = 'VERIFIED'
  AND sp.operational_status = 'ACTIVE'
  AND sp.latitude BETWEEN 13.082700 - 0.3 AND 13.082700 + 0.3
  AND sp.longitude BETWEEN 80.270700 - 0.3 AND 80.270700 + 0.3;

INSERT INTO emergency_alert_notifications (alert_id, shelter_id, notified_admin)
VALUES (88, NULL, TRUE);

INSERT INTO notifications
    (user_id, notification_type, channel, related_entity_type, related_entity_id, title, message, delivery_status)
VALUES
    (3, 'BUZZER_ALERT', 'IN_APP', 'EMERGENCY_ALERT', 88,
     'Emergency buzzer alert', 'A victim has triggered an emergency alert.', 'PENDING');

INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details)
VALUES
    (3, 'SAMPLE_DATA_CREATED', 'DISASTER_EVENT', 3,
     JSON_OBJECT('source', 'initial demo seed', 'note', 'Sample audit entry'));

-- EXAMPLE QUERIES

-- A. Find the 10 nearest verified, active shelters to the sample SOS location.
SELECT
    sp.shelter_id,
    sp.shelter_name,
    ROUND(
      6371 * ACOS(LEAST(1.0, GREATEST(-1.0,
        COS(RADIANS(13.082700)) * COS(RADIANS(sp.latitude)) *
        COS(RADIANS(sp.longitude) - RADIANS(80.270700)) +
        SIN(RADIANS(13.082700)) * SIN(RADIANS(sp.latitude))
      ))),
      2
    ) AS distance_km
FROM shelter_profiles AS sp
WHERE sp.verification_status = 'VERIFIED'
  AND sp.operational_status = 'ACTIVE'
  AND sp.current_occupancy < sp.capacity
  AND sp.latitude BETWEEN 13.082700 - 0.5 AND 13.082700 + 0.5
  AND sp.longitude BETWEEN 80.270700 - 0.5 AND 80.270700 + 0.5
ORDER BY distance_km ASC
LIMIT 10;

-- B. View the complete routing history for the sample SOS request.
SELECT
    sequence_number,
    shelter_id,
    distance_km,
    notified_at,
    responded_at,
    response,
    rejection_reason,
    CASE
      WHEN responded_at IS NULL THEN NULL
      ELSE TIMESTAMPDIFF(SECOND, notified_at, responded_at)
    END AS response_seconds
FROM request_routing_log
WHERE request_id = 501
ORDER BY sequence_number;

-- C. Example: shelter rejects the request, then the next shelter accepts it.
-- These are commented out because the sample routing history already contains both responses.
-- UPDATE request_routing_log
-- SET response = 'REJECTED', responded_at = CURRENT_TIMESTAMP,
--     rejection_reason = 'At full capacity'
-- WHERE request_id = 501 AND shelter_id = 7;
--
-- UPDATE request_routing_log
-- SET response = 'ACCEPTED', responded_at = CURRENT_TIMESTAMP
-- WHERE request_id = 501 AND shelter_id = 15;
--
-- UPDATE sos_requests
-- SET status = 'ACCEPTED', accepted_by_shelter_id = 15
-- WHERE request_id = 501;

-- D. Mark an emergency alert as acknowledged/resolved when appropriate.
-- UPDATE emergency_alert_notifications
-- SET acknowledged_at = CURRENT_TIMESTAMP
-- WHERE alert_id = 88 AND shelter_id = 7;
--
-- UPDATE emergency_alerts
-- SET status = 'RESOLVED', resolved_at = CURRENT_TIMESTAMP
-- WHERE alert_id = 88;

-- E. Inventory dashboard.
SELECT shelter_id, resource_name, category, quantity, unit, low_stock_threshold, status
FROM inventory_items
ORDER BY shelter_id, resource_name;

-- F. Quick verification: all 14 tables should exist.
SHOW TABLES;

select * from admin_profiles;
