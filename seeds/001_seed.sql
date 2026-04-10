-- ============================================================
--  SECURITY PASS — Seed Data
--  All passwords are bcrypt hashed (rounds=12)
--  Plain text passwords are shown in comments
-- ============================================================

-- ─── DEPARTMENTS ───────────────────────────────────────────
INSERT INTO departments (id, name, code) VALUES
  ('d1000000-0000-0000-0000-000000000001', 'Engineering',      'ENG'),
  ('d1000000-0000-0000-0000-000000000002', 'Procurement',      'PROC'),
  ('d1000000-0000-0000-0000-000000000003', 'Human Resources',  'HR'),
  ('d1000000-0000-0000-0000-000000000004', 'Finance',          'FIN'),
  ('d1000000-0000-0000-0000-000000000005', 'Operations',       'OPS'),
  ('d1000000-0000-0000-0000-000000000006', 'Administration',   'ADMIN'),
  ('d1000000-0000-0000-0000-000000000007', 'Security',         'SEC'),
  ('d1000000-0000-0000-0000-000000000008', 'IT',               'IT')
ON CONFLICT DO NOTHING;

-- ─── STAFF USERS ───────────────────────────────────────────
-- Admin/Visitor passwords: 'password'  |  All staff: 'pass@123'  |  Priya: 'priya@123'
-- Hashes generated with bcrypt rounds=10-12
INSERT INTO users (id, email, password_hash, name, phone, role, department_id, designation, initial, color) VALUES

  -- Admin
  ('a1000000-0000-0000-0000-000000000001',
   'admin@securitypass.local',
   '$2a$12$TgYsFjTNI87BnU7wMIQJ/.HGB2Pn3M4Ojb9a4acYX9oFnVWSXhqLW', -- password
   'Admin User', '98000 00001', 'admin',
   'd1000000-0000-0000-0000-000000000006', 'System Administrator', 'AU', '#0891b2'),

  -- Approvers
  ('a1000000-0000-0000-0000-000000000002',
   'priya@company.com',
   '$2a$12$irPYz8Hg.71wmRQy7.j5H.8uHECXAWWtK6Goh7Z.eTlbOOsS1tOue', -- priya@123
   'Priya Sharma', '98001 11111', 'approver',
   'd1000000-0000-0000-0000-000000000001', 'Senior Engineer', 'PS', '#6366f1'),

  ('a1000000-0000-0000-0000-000000000003',
   'rohan@company.com',
   '$2a$10$7OUzxBIHYjoLTxmXD/ihTOdf2H0lJtl7miz20jRvmxueiIhgpThbO', -- pass@123
   'Rohan Mehta', '98001 22222', 'approver',
   'd1000000-0000-0000-0000-000000000002', 'Procurement Head', 'RM', '#10b981'),

  ('a1000000-0000-0000-0000-000000000004',
   'kavita@company.com',
   '$2a$10$7OUzxBIHYjoLTxmXD/ihTOdf2H0lJtl7miz20jRvmxueiIhgpThbO', -- pass@123
   'Kavita Rao', '98001 33333', 'approver',
   'd1000000-0000-0000-0000-000000000003', 'HR Manager', 'KR', '#f59e0b'),

  ('a1000000-0000-0000-0000-000000000005',
   'dev@company.com',
   '$2a$12$7pG.hGq8bNJXUlpq3VIxuepRTKsHCWq5OOkRNgFwqzI7J4eqgqJ9C', -- dev@123
   'Dev Anand', '98001 44444', 'approver',
   'd1000000-0000-0000-0000-000000000004', 'Finance Director', 'DA', '#ef4444'),

  ('a1000000-0000-0000-0000-000000000006',
   'suresh@company.com',
   '$2a$12$7pG.hGq8bNJXUlpq3VIxuepRTKsHCWq5OOkRNgFwqzI7J4eqgqJ9C', -- suresh@123
   'Suresh Pillai', '98001 55555', 'approver',
   'd1000000-0000-0000-0000-000000000005', 'Operations Manager', 'SP', '#3b82f6'),

  ('a1000000-0000-0000-0000-000000000007',
   'meena@company.com',
   '$2a$12$7pG.hGq8bNJXUlpq3VIxuepRTKsHCWq5OOkRNgFwqzI7J4eqgqJ9C', -- meena@123
   'Meena Krishnan', '98001 66666', 'approver',
   'd1000000-0000-0000-0000-000000000008', 'IT Head', 'MK', '#8b5cf6'),

  ('a1000000-0000-0000-0000-000000000008',
   'arjun@company.com',
   '$2a$12$7pG.hGq8bNJXUlpq3VIxuepRTKsHCWq5OOkRNgFwqzI7J4eqgqJ9C', -- arjun@123
   'Arjun Nambiar', '98001 77777', 'approver',
   'd1000000-0000-0000-0000-000000000001', 'Tech Lead', 'AN', '#06b6d4'),

  ('a1000000-0000-0000-0000-000000000009',
   'anjali@company.com',
   '$2a$12$7pG.hGq8bNJXUlpq3VIxuepRTKsHCWq5OOkRNgFwqzI7J4eqgqJ9C', -- anjali@123
   'Anjali Das', '98001 88888', 'admin',
   'd1000000-0000-0000-0000-000000000006', 'Admin Director', 'AD', '#8b5cf6'),

  -- Gate Users
  ('a1000000-0000-0000-0000-000000000010',
   'ravi@company.com',
   '$2a$12$7pG.hGq8bNJXUlpq3VIxuepRTKsHCWq5OOkRNgFwqzI7J4eqgqJ9C', -- ravi@123
   'Ravi Kumar', '98001 99991', 'gate',
   'd1000000-0000-0000-0000-000000000007', 'Security Guard', 'RK', '#f59e0b'),

  ('a1000000-0000-0000-0000-000000000011',
   'sunita.g@company.com',
   '$2a$12$7pG.hGq8bNJXUlpq3VIxuepRTKsHCWq5OOkRNgFwqzI7J4eqgqJ9C', -- sunita@123
   'Sunita George', '98001 99992', 'gate',
   'd1000000-0000-0000-0000-000000000007', 'Security Guard', 'SG', '#10b981'),

  -- Visitor demo account
  ('a1000000-0000-0000-0000-000000000012',
   'visitor@securitypass.local',
   '$2a$12$TgYsFjTNI87BnU7wMIQJ/.HGB2Pn3M4Ojb9a4acYX9oFnVWSXhqLW', -- password
   'Rajesh Kumar', '98765 43210', 'visitor', NULL, 'Visitor', 'RK', '#0891b2')

ON CONFLICT DO NOTHING;

-- ─── VISITOR PROFILES ──────────────────────────────────────
INSERT INTO visitor_profiles (user_id, company, govt_id_type, govt_id_number, vehicle_number, vehicle_type, total_visits) VALUES
  ('a1000000-0000-0000-0000-000000000012',
   'TechCorp Ltd', 'Aadhaar', 'XXXX XXXX 1234', 'MH 01 AB 1234', 'Car', 4)
ON CONFLICT DO NOTHING;

-- ─── DEMO PASSES ───────────────────────────────────────────
INSERT INTO passes (
  id, pass_number, visitor_name, visitor_phone, visitor_email,
  visitor_company, purpose, description,
  valid_from, valid_until,
  host_user_id, host_name, department_id, department_name,
  status, qr_enabled, qr_token, qr_url,
  approved_by_name, approved_at,
  created_at
) VALUES
  -- Pending
  ('b1000000-0000-0000-0000-000000000001',
   'SP-20240408-0001', 'Rajesh Kumar', '98765 43210', 'rajesh@techcorp.com',
   'TechCorp Ltd', 'meeting', 'Quarterly product review',
   '2024-04-08 09:00:00+00', '2024-04-08 23:59:00+00',
   'a1000000-0000-0000-0000-000000000002', 'Priya Sharma',
   'd1000000-0000-0000-0000-000000000001', 'Engineering',
   'pending', FALSE, NULL, NULL, NULL, NULL,
   '2024-04-08 08:30:00+00'),

  -- Approved with entry/exit
  ('b1000000-0000-0000-0000-000000000002',
   'SP-20240408-0002', 'Sunita Patel', '91234 56789', NULL,
   'Acme Supplies', 'delivery', 'Monthly stationery delivery',
   '2024-04-08 10:00:00+00', '2024-04-08 23:59:00+00',
   'a1000000-0000-0000-0000-000000000003', 'Rohan Mehta',
   'd1000000-0000-0000-0000-000000000002', 'Procurement',
   'approved', TRUE,
   'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0',
   'https://securitypass.app/verify/SP-20240408-0002?token=a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6',
   'Rohan Mehta', '2024-04-08 07:05:00+00',
   '2024-04-08 07:00:00+00'),

  -- Approved + entry logged (still inside)
  ('b1000000-0000-0000-0000-000000000003',
   'SP-20240408-0003', 'Arjun Singh', '90000 12345', NULL,
   'Vertex IT Solutions', 'audit', 'Annual IT systems audit',
   '2024-04-08 09:00:00+00', '2024-04-09 18:00:00+00',
   'a1000000-0000-0000-0000-000000000007', 'Meena Krishnan',
   'd1000000-0000-0000-0000-000000000008', 'IT',
   'approved', TRUE,
   'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1',
   'https://securitypass.app/verify/SP-20240408-0003?token=b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7',
   'Meena Krishnan', '2024-04-08 08:55:00+00',
   '2024-04-08 08:00:00+00'),

  -- Rejected
  ('b1000000-0000-0000-0000-000000000004',
   'SP-20240408-0004', 'Pradeep Nair', '88888 77777', NULL,
   'Generic Corp', 'vendor', 'Vendor visit',
   '2024-04-08 14:00:00+00', '2024-04-08 23:59:00+00',
   'a1000000-0000-0000-0000-000000000004', 'Kavita Rao',
   'd1000000-0000-0000-0000-000000000003', 'Human Resources',
   'rejected', FALSE, NULL, NULL, NULL, NULL,
   '2024-04-08 10:00:00+00'),

  -- Expired
  ('b1000000-0000-0000-0000-000000000005',
   'SP-20240407-0001', 'Meera Iyer', '77777 66666', NULL,
   'Bright Ideas Ltd', 'interview', 'Candidate interview',
   '2024-04-07 10:00:00+00', '2024-04-07 18:00:00+00',
   'a1000000-0000-0000-0000-000000000004', 'Kavita Rao',
   'd1000000-0000-0000-0000-000000000003', 'Human Resources',
   'expired', TRUE,
   'c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
   'https://securitypass.app/verify/SP-20240407-0001?token=c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8',
   'Kavita Rao', '2024-04-07 09:45:00+00',
   '2024-04-07 09:00:00+00')

ON CONFLICT DO NOTHING;

-- ─── GATE LOGS ─────────────────────────────────────────────
INSERT INTO gate_logs (pass_id, log_type, gate_name, logged_by_name, logged_at) VALUES
  -- p2: entry + exit
  ('b1000000-0000-0000-0000-000000000002', 'entry', 'Main Gate', 'Ravi Kumar', '2024-04-08 10:14:00+00'),
  ('b1000000-0000-0000-0000-000000000002', 'exit',  'Main Gate', 'Ravi Kumar', '2024-04-08 11:40:00+00'),
  -- p3: entry only (still inside)
  ('b1000000-0000-0000-0000-000000000003', 'entry', 'Main Gate', 'Sunita George', '2024-04-08 09:05:00+00'),
  -- p5: entry + exit (expired)
  ('b1000000-0000-0000-0000-000000000005', 'entry', 'Side Gate', 'Ravi Kumar', '2024-04-07 10:05:00+00'),
  ('b1000000-0000-0000-0000-000000000005', 'exit',  'Side Gate', 'Ravi Kumar', '2024-04-07 12:30:00+00')
ON CONFLICT DO NOTHING;

-- ─── NOTIFICATIONS ─────────────────────────────────────────
INSERT INTO notifications (target_user_id, event, title, message, pass_id, status) VALUES
  ('a1000000-0000-0000-0000-000000000002', 'pass_pending',
   'New security pass awaiting your approval',
   'Rajesh Kumar (TechCorp Ltd) has requested a pass for a meeting on 8 Apr 2024.',
   'b1000000-0000-0000-0000-000000000001', 'unread'),

  ('a1000000-0000-0000-0000-000000000003', 'pass_approved',
   'Pass SP-20240408-0002 has been approved',
   'You approved the pass for Sunita Patel (Acme Supplies).',
   'b1000000-0000-0000-0000-000000000002', 'read'),

  ('a1000000-0000-0000-0000-000000000010', 'pass_entry',
   'Visitor entry logged — Sunita Patel',
   'Entry recorded at Main Gate for pass SP-20240408-0002.',
   'b1000000-0000-0000-0000-000000000002', 'read'),

  ('a1000000-0000-0000-0000-000000000012', 'pass_approved',
   'Your security pass has been approved!',
   'Your pass SP-20240408-0003 has been approved. Please show QR code at the gate.',
   'b1000000-0000-0000-0000-000000000003', 'unread')

ON CONFLICT DO NOTHING;
