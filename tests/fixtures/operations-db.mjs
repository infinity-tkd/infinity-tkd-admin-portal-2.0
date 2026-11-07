import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {citext} from '@electric-sql/pglite/contrib/citext';
export const root='91000000-0000-4000-8000-000000000001',coach='91000000-0000-4000-8000-000000000002';
export async function operationsDatabase(){
 const db=new PGlite({extensions:{citext}});
 await db.exec(fs.readFileSync('tests/fixtures/live-schema-20261011.sql','utf8'));
 await db.exec(`INSERT INTO auth.users(id,email) VALUES('${root}','owner@example.test'),('${coach}','coach@example.test');INSERT INTO branches(id,branch_name) VALUES(1,'Fixture branch');INSERT INTO scholarships(id,type_name) VALUES(1,'Standard');INSERT INTO profiles(id,username,email,display_name,role) VALUES('${root}','owner','owner@example.test','Fixture owner','Root');`);
 for(const file of ['supabase/production-upgrade-20261009.sql','supabase/migrations/20261013052326_portal_telegram_contacts_and_access.sql','supabase/migrations/20261023155619_membership_makeup_notifications.sql','supabase/migrations/20261025164318_academy_operations_workflows.sql'])await db.exec(fs.readFileSync(file,'utf8'));
 await db.exec(`SELECT set_config('request.jwt.role','service_role',false);SELECT set_config('request.jwt.sub','${root}',false);SELECT set_config('request.jwt.claims','{"aal":"aal2"}',false);INSERT INTO profiles(id,username,email,display_name,role) VALUES('${coach}','coach','coach@example.test','Fixture coach','Coach');INSERT INTO students(id,khmer_name,english_name,gender,dob,registration_date,scholarship_id,home_branch_id,student_status) VALUES('STU-M-001','Fixture','Athlete','Male','2010-01-01','2026-01-15',1,1,'Active'),('STU-M-002','Fixture','Other athlete','Male','2010-01-01','2026-01-15',1,1,'Active');INSERT INTO belts(id,belt_name,belt_order,belt_type) VALUES(1,'White',1,'Color'),(2,'Yellow',2,'Color');`);
 return db;
}

