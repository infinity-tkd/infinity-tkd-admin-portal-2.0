import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {operationsDatabase} from './fixtures/operations-db.mjs';

const authoring='supabase/migrations/20261102181741_workout_authoring_publications.sql';
const migration='supabase/migrations/20261102183241_workout_authoring_foreign_key_indexes.sql';

test('authoring foreign keys have usable leading-column indexes without content or browser grant changes',async()=>{
 const db=await operationsDatabase();try{
  await db.exec(fs.readFileSync(authoring,'utf8'));
  await db.exec(fs.readFileSync(migration,'utf8'));
  const coverage=(await db.query(`SELECT con.conrelid::regclass::text relation,att.attname column_name,
    EXISTS(SELECT 1 FROM pg_index idx WHERE idx.indrelid=con.conrelid AND idx.indisvalid AND idx.indpred IS NULL AND idx.indkey[0]=con.conkey[1]) covered
    FROM pg_constraint con JOIN pg_attribute att ON att.attrelid=con.conrelid AND att.attnum=con.conkey[1]
    WHERE con.contype='f' AND con.conrelid IN('public.portal_workout_commands'::regclass,'public.workout_template_drafts'::regclass)
    ORDER BY relation,column_name`)).rows;
  assert.deepEqual(coverage,[{relation:'portal_workout_commands',column_name:'actor_id',covered:true},{relation:'workout_template_drafts',column_name:'created_by',covered:true},{relation:'workout_template_drafts',column_name:'updated_by',covered:true}]);
  assert.deepEqual((await db.query('SELECT (SELECT count(*)::int FROM workout_template_drafts) drafts,(SELECT count(*)::int FROM portal_workout_commands) commands')).rows,[{drafts:0,commands:0}]);
  for(const table of ['workout_template_drafts','portal_workout_commands'])assert.equal((await db.query('SELECT has_table_privilege($1,$2,$3) allowed',['authenticated','public.'+table,'SELECT'])).rows[0].allowed,false);
 }finally{await db.close();}
});
