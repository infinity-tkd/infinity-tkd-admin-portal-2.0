import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lyjxmkyvqazqxkzoeszr.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY in environment.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function main() {
  console.log('--- Starting BodyParts3D Muscle Database Seeding ---');

  // Load atlas.json
  const atlasPath = path.resolve('public/models/atlas.json');
  if (!fs.existsSync(atlasPath)) {
    console.error('atlas.json not found at:', atlasPath);
    process.exit(1);
  }
  const atlas = JSON.parse(fs.readFileSync(atlasPath, 'utf8'));
  console.log(`Loaded atlas: ${atlas.parts.length} parts, ${atlas.concepts.length} concepts.`);

  // Filter muscular parts and concepts
  const muscularParts = atlas.parts.filter((p) => p.system === 'muscular');
  const partMap = new Map(muscularParts.map((p) => [p.id, p]));
  const conceptMap = new Map(atlas.concepts.map((c) => [c.id, c]));

  const muscularConcepts = [];
  const seenConcepts = new Set();
  for (const p of muscularParts) {
    if (!seenConcepts.has(p.conceptId)) {
      seenConcepts.add(p.conceptId);
      const c = conceptMap.get(p.conceptId);
      if (c) {
        muscularConcepts.push({
          id: c.id,
          name: c.name,
          elements: c.elements,
          bounds: p.bounds,
        });
      }
    }
  }
  console.log(`Extracted ${muscularConcepts.length} unique muscular concepts from BodyParts3D.`);

  // Fetch existing database muscles
  const { data: existingMuscles, error: fetchErr } = await supabase
    .from('muscles')
    .select('*')
    .order('id');

  if (fetchErr) {
    console.error('Error fetching existing muscles:', fetchErr.message);
    process.exit(1);
  }

  console.log(`Found ${existingMuscles.length} existing rows in public.muscles.`);

  // Regional classifier helper
  function classifyMuscleGroup(name) {
    const lower = name.toLowerCase();
    if (
      lower.includes('femur') ||
      lower.includes('femoris') ||
      lower.includes('tibia') ||
      lower.includes('tibialis') ||
      lower.includes('fibular') ||
      lower.includes('peroneus') ||
      lower.includes('gastrocnemius') ||
      lower.includes('soleus') ||
      lower.includes('quadriceps') ||
      lower.includes('vastus') ||
      lower.includes('rectus femoris') ||
      lower.includes('sartorius') ||
      lower.includes('gracilis') ||
      lower.includes('gluteus') ||
      lower.includes('gluteal') ||
      lower.includes('plantaris') ||
      lower.includes('popliteus') ||
      lower.includes('semitendinosus') ||
      lower.includes('semimembranosus') ||
      lower.includes('iliopsoas') ||
      lower.includes('pectineus') ||
      lower.includes('adductor') ||
      lower.includes('tensor fasciae')
    ) {
      return 'Lower Body';
    }
    if (
      lower.includes('abdominis') ||
      lower.includes('oblique') ||
      lower.includes('transversus') ||
      lower.includes('erector spinae') ||
      lower.includes('intercostal') ||
      lower.includes('diaphragm') ||
      lower.includes('lumbar') ||
      lower.includes('quadratus lumborum') ||
      lower.includes('psoas') ||
      lower.includes('iliacus') ||
      lower.includes('pelvic')
    ) {
      return 'Core';
    }
    if (
      lower.includes('biceps brachii') ||
      lower.includes('triceps brachii') ||
      lower.includes('brachialis') ||
      lower.includes('brachioradialis') ||
      lower.includes('deltoid') ||
      lower.includes('pectoralis') ||
      lower.includes('latissimus') ||
      lower.includes('trapezius') ||
      lower.includes('rhomboid') ||
      lower.includes('supraspinatus') ||
      lower.includes('infraspinatus') ||
      lower.includes('teres') ||
      lower.includes('subscapularis') ||
      lower.includes('coracobrachialis') ||
      lower.includes('pronator') ||
      lower.includes('supinator') ||
      lower.includes('carpi') ||
      lower.includes('digitorum') ||
      lower.includes('pollicis') ||
      lower.includes('serratus')
    ) {
      return 'Upper Body';
    }
    if (
      lower.includes('rectus capitis') ||
      lower.includes('splenius') ||
      lower.includes('scalenus') ||
      lower.includes('sternocleidomastoid') ||
      lower.includes('hyoid') ||
      lower.includes('pharyngeal') ||
      lower.includes('laryngeal') ||
      lower.includes('oculi') ||
      lower.includes('oris') ||
      lower.includes('masseter') ||
      lower.includes('temporalis') ||
      lower.includes('pterygoid')
    ) {
      return 'Head & Neck';
    }
    return 'Muscular System';
  }

  // Check which columns exist in muscles table
  const testObj = existingMuscles[0] || {};
  const hasConceptIdCol = 'concept_id' in testObj;

  // 1. Update existing rows with concept IDs and part elements
  let updatedCount = 0;
  for (const m of existingMuscles) {
    const cleanName = m.name.toLowerCase().replace(/\s*\(.*?\)\s*/g, '').trim();
    // find match in muscularConcepts
    const match = muscularConcepts.find(
      (c) =>
        c.name.toLowerCase() === cleanName ||
        c.name.toLowerCase().includes(cleanName) ||
        cleanName.includes(c.name.toLowerCase())
    );

    const updatePayload = {};
    const metadata = {
      conceptId: match?.id || null,
      elements: match?.elements || [],
      system: 'muscular',
      latinName: m.name,
      origin: m.target_function || '',
      updatedAt: new Date().toISOString(),
    };

    updatePayload.description = JSON.stringify(metadata);

    if (match) {
      if (hasConceptIdCol) {
        updatePayload.concept_id = match.id;
        updatePayload.element_ids = match.elements;
        updatePayload.fma_id = match.id;
        updatePayload.bounds = match.bounds;
      }
      if (!m.target_function) {
        updatePayload.target_function = `Anatomical concept ${match.id}: ${match.name}`;
      }
    }

    const { error: upErr } = await supabase
      .from('muscles')
      .update(updatePayload)
      .eq('id', m.id);

    if (upErr) {
      console.warn(`Failed to update muscle id ${m.id} (${m.name}):`, upErr.message);
    } else {
      updatedCount++;
    }
  }
  console.log(`Updated ${updatedCount} existing muscle rows with BodyParts3D metadata.`);

  // 2. Insert remaining BodyParts3D concepts
  const existingNamesLower = new Set(existingMuscles.map((m) => m.name.toLowerCase().trim()));
  const existingDescriptions = new Set(
    existingMuscles.map((m) => {
      try {
        return JSON.parse(m.description || '{}').conceptId;
      } catch {
        return null;
      }
    }).filter(Boolean)
  );

  const conceptsToInsert = muscularConcepts.filter(
    (c) =>
      !existingNamesLower.has(c.name.toLowerCase().trim()) &&
      !existingDescriptions.has(c.id)
  );

  console.log(`Identified ${conceptsToInsert.length} new anatomical concepts to seed.`);

  let insertedCount = 0;
  const batchSize = 40;
  for (let i = 0; i < conceptsToInsert.length; i += batchSize) {
    const batch = conceptsToInsert.slice(i, i + batchSize);
    const rows = batch.map((c) => {
      const group = classifyMuscleGroup(c.name);
      const row = {
        name: c.name.charAt(0).toUpperCase() + c.name.slice(1),
        muscle_group: group,
        target_function: `BodyParts3D Concept: ${c.name} (${c.id})`,
        description: JSON.stringify({
          conceptId: c.id,
          elements: c.elements,
          system: 'muscular',
          bounds: c.bounds,
        }),
      };
      if (hasConceptIdCol) {
        row.concept_id = c.id;
        row.element_ids = c.elements;
        row.fma_id = c.id;
        row.bounds = c.bounds;
        row.system = 'muscular';
      }
      return row;
    });

    const { data: insData, error: insErr } = await supabase
      .from('muscles')
      .insert(rows)
      .select('id');

    if (insErr) {
      console.error(`Batch insert error at index ${i}:`, insErr.message);
    } else {
      insertedCount += (insData || []).length;
    }
  }

  console.log(`--- Seeding Complete: ${insertedCount} new muscles added to database! ---`);
  const { count: finalCount } = await supabase.from('muscles').select('*', { count: 'exact', head: true });
  console.log(`Total muscles now in public.muscles: ${finalCount}`);
}

main().catch(console.error);
