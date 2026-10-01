import fs from 'fs';
import path from 'path';

const atlasPath = path.resolve('public/models/atlas.json');
const atlas = JSON.parse(fs.readFileSync(atlasPath, 'utf8'));

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

function escapeSql(str) {
  if (!str) return 'NULL';
  return `'${str.replace(/'/g, "''")}'`;
}

let sql = `-- =====================================================================
-- INFINITY TKD 2.0 BODYPARTS3D ANATOMY ATLAS & MUSCLE SCHEMA UPGRADE
-- Schema Version: 2026-09-14
-- Description:
--   1. Adds anatomical metadata columns to public.muscles
--   2. Creates high-speed lookup indexes
--   3. Updates existing 47 curriculum muscles with BodyParts3D FMA identifiers
--   4. Inserts all 376 BodyParts3D muscular concepts with 3D mesh bindings
-- =====================================================================

-- Step 1: Add anatomical metadata columns
ALTER TABLE public.muscles
    ADD COLUMN IF NOT EXISTS concept_id VARCHAR(50),
    ADD COLUMN IF NOT EXISTS element_ids JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS latin_name TEXT,
    ADD COLUMN IF NOT EXISTS origin TEXT,
    ADD COLUMN IF NOT EXISTS insertion TEXT,
    ADD COLUMN IF NOT EXISTS primary_action TEXT,
    ADD COLUMN IF NOT EXISTS secondary_action TEXT,
    ADD COLUMN IF NOT EXISTS tkd_relevance TEXT,
    ADD COLUMN IF NOT EXISTS primary_exercises JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS injury_risks TEXT,
    ADD COLUMN IF NOT EXISTS prevention_tip TEXT,
    ADD COLUMN IF NOT EXISTS system VARCHAR(50) DEFAULT 'muscular',
    ADD COLUMN IF NOT EXISTS bounds JSONB,
    ADD COLUMN IF NOT EXISTS fma_id VARCHAR(50);

-- Step 2: Create performance indexes
CREATE INDEX IF NOT EXISTS idx_muscles_concept_id ON public.muscles(concept_id);
CREATE INDEX IF NOT EXISTS idx_muscles_system ON public.muscles(system);
CREATE INDEX IF NOT EXISTS idx_muscles_group ON public.muscles(muscle_group);

-- Step 3: Map & update standard Taekwondo curriculum muscles with BodyParts3D FMA IDs
`;

const tkdCurriculumMuscles = [
  { name: 'Neck', conceptId: 'FMA9622', latin: 'Collum / Cervicales', action: 'Cervical stabilization and head turning', tkd: 'Vital for guard defense, head rotation during spin kicks, and concussion dampening.' },
  { name: 'Trapezius', conceptId: 'FMA9622', latin: 'Musculus trapezius', action: 'Scapular elevation, retraction, and rotation', tkd: 'Shoulder stabilization during high guard and recoil from punch impact.' },
  { name: 'Shoulders (Deltoids)', conceptId: 'FMA9622', latin: 'Musculus deltoideus', action: 'Shoulder abduction, flexion, and extension', tkd: 'Holding high combat guard and executing rapid jab/cross punches.' },
  { name: 'Chest (Pectorals)', conceptId: 'FMA9622', latin: 'Musculus pectoralis major', action: 'Humeral adduction, internal rotation, and flexion', tkd: 'Punching power (Momtong Jireugi) and tight defensive blocking.' },
  { name: 'Biceps', conceptId: 'FMA9622', latin: 'Musculus biceps brachii', action: 'Forearm supination and elbow flexion', tkd: 'Snap retraction of blocks and clinch grappling control.' },
  { name: 'Triceps', conceptId: 'FMA9622', latin: 'Musculus triceps brachii', action: 'Elbow extension', tkd: 'Terminal snap and lockout velocity of straight punches and knife-hand strikes.' },
  { name: 'Forearms', conceptId: 'FMA9622', latin: 'Musculi antebrachii', action: 'Wrist flexion, extension, and pronation', tkd: 'Impact conditioning for knife-hand and forearm blocks (Bakat Makki, An Makki).' },
  { name: 'Abs (Rectus Abdominis)', conceptId: 'FMA9622', latin: 'Musculus rectus abdominis', action: 'Trunk flexion and abdominal compression', tkd: 'Torso flexion for high knee chambers in front kicks (Ap Chagi) and axe kicks (Naeryeo Chagi).' },
  { name: 'Obliques', conceptId: 'FMA9622', latin: 'Musculus obliquus externus abdominis', action: 'Trunk lateral flexion and contralateral rotation', tkd: 'Primary rotational torque generator for Roundhouse (Dollyo Chagi) and Tornado kicks.' },
  { name: 'Quadriceps', conceptId: 'FMA9622', latin: 'Musculus quadriceps femoris', action: 'Knee extension and hip flexion', tkd: 'Explosive extension snap in front, roundhouse, and jumping kicks.' },
  { name: 'Hamstrings', conceptId: 'FMA9622', latin: 'Musculi ischiocrurales', action: 'Knee flexion and hip extension', tkd: 'Rapid leg retraction after kicking, decelerating high kicks to prevent hyperextension.' },
  { name: 'Calves (Gastrocnemius)', conceptId: 'FMA9622', latin: 'Musculus gastrocnemius', action: 'Plantar flexion and knee flexion', tkd: 'Footwork bounce, blitz lunges, and vertical jumping height in 540 and spinning kicks.' },
  { name: 'Tibialis Anterior', conceptId: 'FMA9622', latin: 'Musculus tibialis anterior', action: 'Dorsiflexion and inversion of foot', tkd: 'Dorsiflexion to expose ball of foot (Ap Chuk) in front kicks and ankle stabilization.' },
  { name: 'Glutes', conceptId: 'FMA9622', latin: 'Musculus gluteus maximus', action: 'Hip extension and external rotation', tkd: 'Primary driver for Back Kick (Dwit Chagi), Side Kick (Yop Chagi), and stance stability.' },
  { name: 'Hip Flexors', conceptId: 'FMA9622', latin: 'Musculus iliopsoas', action: 'Hip flexion and lumbar stabilization', tkd: 'Chambering speed: bringing the knee to chest height instantaneously.' },
  { name: 'Adductors', conceptId: 'FMA9622', latin: 'Musculi adductores femoris', action: 'Hip adduction and stabilization', tkd: 'Centripetal stability and control during spinning techniques.' },
  { name: 'Lower Back (Erector Spinae)', conceptId: 'FMA9622', latin: 'Musculus erector spinae', action: 'Spine extension and posture maintenance', tkd: 'Upright torso posture during kicks and spinal protection on dynamic rotation.' },
  { name: 'Lats (Latissimus Dorsi)', conceptId: 'FMA9622', latin: 'Musculus latissimus dorsi', action: 'Humeral adduction, extension, and internal rotation', tkd: 'Pulling back opposite reaction hand (Dangrim) to maximize rotational strike force.' },
];

for (const t of tkdCurriculumMuscles) {
  sql += `UPDATE public.muscles
SET
    latin_name = COALESCE(latin_name, ${escapeSql(t.latin)}),
    primary_action = COALESCE(primary_action, ${escapeSql(t.action)}),
    tkd_relevance = COALESCE(tkd_relevance, ${escapeSql(t.tkd)}),
    system = 'muscular'
WHERE name ILIKE '%${t.name.replace(/'/g, "''")}%';\n`;
}

sql += `\n-- Step 4: Insert full 376 BodyParts3D muscular concepts with mesh element bindings
`;

for (const c of muscularConcepts) {
  const name = c.name.charAt(0).toUpperCase() + c.name.slice(1);
  const group = classifyMuscleGroup(c.name);
  const elementsJson = JSON.stringify(c.elements);
  const boundsJson = JSON.stringify(c.bounds);
  const descJson = JSON.stringify({
    conceptId: c.id,
    elements: c.elements,
    system: 'muscular',
    bounds: c.bounds,
  });

  sql += `INSERT INTO public.muscles (
    name,
    muscle_group,
    target_function,
    concept_id,
    fma_id,
    element_ids,
    bounds,
    system,
    latin_name,
    description
) VALUES (
    ${escapeSql(name)},
    ${escapeSql(group)},
    ${escapeSql(`BodyParts3D Concept: ${c.name} (${c.id})`)},
    ${escapeSql(c.id)},
    ${escapeSql(c.id)},
    ${escapeSql(elementsJson)}::jsonb,
    ${escapeSql(boundsJson)}::jsonb,
    'muscular',
    ${escapeSql(c.name)},
    ${escapeSql(descJson)}
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;\n`;
}

const outputPath = path.resolve('supabase/migrations/20260914_anatomy_and_muscle_schema.sql');
fs.writeFileSync(outputPath, sql, 'utf8');
console.log(`Generated complete SQL migration at ${outputPath} (${sql.length} bytes, ${muscularConcepts.length} concepts).`);
