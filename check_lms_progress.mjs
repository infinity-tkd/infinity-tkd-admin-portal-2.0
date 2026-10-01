import { createClient } from '@supabase/supabase-js';

const NEXT_PUBLIC_SUPABASE_URL = 'https://lyjxmkyvqazqxkzoeszr.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testInsertVideoId() {
  console.log("=== Attempting insert into lms_progress with video_id ===");
  const { data: studentData } = await supabase.from('students').select('id').limit(1);
  const studentId = studentData?.[0]?.id;

  const { data: assetData } = await supabase.from('library_assets').select('id').limit(1);
  const videoId = assetData?.[0]?.id;

  console.log(`Using studentId: ${studentId}, videoId: ${videoId}`);

  if (!studentId || !videoId) {
    console.log("Missing student or library asset. Cannot test.");
    return;
  }

  // Attempt using video_id
  const { data: insertData, error: insertError } = await supabase.from('lms_progress').insert({
    student_id: studentId,
    video_id: videoId,
    completed_at: new Date().toISOString(),
    last_watched_position_seconds: 0
  }).select();

  if (insertError) {
    console.log("Insert with video_id FAILED:", insertError);
  } else {
    console.log("Insert with video_id SUCCEEDED! Row:", insertData[0]);
    // Clean up
    await supabase.from('lms_progress').delete().eq('id', insertData[0].id);
  }

  // Attempt using curriculum_id to compare
  console.log("=== Attempting insert into lms_progress with curriculum_id ===");
  // Upsert parent curriculum row first
  const { error: currUpsertError } = await supabase.from('curriculum').upsert({
    id: videoId,
    target_belt: 'White',
    title: 'Test Video',
    category: 'Recognized Poomsae'
  });
  if (currUpsertError) {
    console.log("Curriculum upsert failed:", currUpsertError);
  }

  const { data: curData, error: curError } = await supabase.from('lms_progress').insert({
    student_id: studentId,
    curriculum_id: videoId,
    status: 'Completed',
    last_watched_at: new Date().toISOString()
  }).select();

  if (curError) {
    console.log("Insert with curriculum_id FAILED:", curError.message);
  } else {
    console.log("Insert with curriculum_id SUCCEEDED! Row:", curData[0]);
    await supabase.from('lms_progress').delete().eq('id', curData[0].id);
  }
}

testInsertVideoId();
