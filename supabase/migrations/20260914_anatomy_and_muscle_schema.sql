-- =====================================================================
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
UPDATE public.muscles
SET
    latin_name = COALESCE(latin_name, 'Collum / Cervicales'),
    primary_action = COALESCE(primary_action, 'Cervical stabilization and head turning'),
    tkd_relevance = COALESCE(tkd_relevance, 'Vital for guard defense, head rotation during spin kicks, and concussion dampening.'),
    system = 'muscular'
WHERE name ILIKE '%Neck%';
UPDATE public.muscles
SET
    latin_name = COALESCE(latin_name, 'Musculus trapezius'),
    primary_action = COALESCE(primary_action, 'Scapular elevation, retraction, and rotation'),
    tkd_relevance = COALESCE(tkd_relevance, 'Shoulder stabilization during high guard and recoil from punch impact.'),
    system = 'muscular'
WHERE name ILIKE '%Trapezius%';
UPDATE public.muscles
SET
    latin_name = COALESCE(latin_name, 'Musculus deltoideus'),
    primary_action = COALESCE(primary_action, 'Shoulder abduction, flexion, and extension'),
    tkd_relevance = COALESCE(tkd_relevance, 'Holding high combat guard and executing rapid jab/cross punches.'),
    system = 'muscular'
WHERE name ILIKE '%Shoulders (Deltoids)%';
UPDATE public.muscles
SET
    latin_name = COALESCE(latin_name, 'Musculus pectoralis major'),
    primary_action = COALESCE(primary_action, 'Humeral adduction, internal rotation, and flexion'),
    tkd_relevance = COALESCE(tkd_relevance, 'Punching power (Momtong Jireugi) and tight defensive blocking.'),
    system = 'muscular'
WHERE name ILIKE '%Chest (Pectorals)%';
UPDATE public.muscles
SET
    latin_name = COALESCE(latin_name, 'Musculus biceps brachii'),
    primary_action = COALESCE(primary_action, 'Forearm supination and elbow flexion'),
    tkd_relevance = COALESCE(tkd_relevance, 'Snap retraction of blocks and clinch grappling control.'),
    system = 'muscular'
WHERE name ILIKE '%Biceps%';
UPDATE public.muscles
SET
    latin_name = COALESCE(latin_name, 'Musculus triceps brachii'),
    primary_action = COALESCE(primary_action, 'Elbow extension'),
    tkd_relevance = COALESCE(tkd_relevance, 'Terminal snap and lockout velocity of straight punches and knife-hand strikes.'),
    system = 'muscular'
WHERE name ILIKE '%Triceps%';
UPDATE public.muscles
SET
    latin_name = COALESCE(latin_name, 'Musculi antebrachii'),
    primary_action = COALESCE(primary_action, 'Wrist flexion, extension, and pronation'),
    tkd_relevance = COALESCE(tkd_relevance, 'Impact conditioning for knife-hand and forearm blocks (Bakat Makki, An Makki).'),
    system = 'muscular'
WHERE name ILIKE '%Forearms%';
UPDATE public.muscles
SET
    latin_name = COALESCE(latin_name, 'Musculus rectus abdominis'),
    primary_action = COALESCE(primary_action, 'Trunk flexion and abdominal compression'),
    tkd_relevance = COALESCE(tkd_relevance, 'Torso flexion for high knee chambers in front kicks (Ap Chagi) and axe kicks (Naeryeo Chagi).'),
    system = 'muscular'
WHERE name ILIKE '%Abs (Rectus Abdominis)%';
UPDATE public.muscles
SET
    latin_name = COALESCE(latin_name, 'Musculus obliquus externus abdominis'),
    primary_action = COALESCE(primary_action, 'Trunk lateral flexion and contralateral rotation'),
    tkd_relevance = COALESCE(tkd_relevance, 'Primary rotational torque generator for Roundhouse (Dollyo Chagi) and Tornado kicks.'),
    system = 'muscular'
WHERE name ILIKE '%Obliques%';
UPDATE public.muscles
SET
    latin_name = COALESCE(latin_name, 'Musculus quadriceps femoris'),
    primary_action = COALESCE(primary_action, 'Knee extension and hip flexion'),
    tkd_relevance = COALESCE(tkd_relevance, 'Explosive extension snap in front, roundhouse, and jumping kicks.'),
    system = 'muscular'
WHERE name ILIKE '%Quadriceps%';
UPDATE public.muscles
SET
    latin_name = COALESCE(latin_name, 'Musculi ischiocrurales'),
    primary_action = COALESCE(primary_action, 'Knee flexion and hip extension'),
    tkd_relevance = COALESCE(tkd_relevance, 'Rapid leg retraction after kicking, decelerating high kicks to prevent hyperextension.'),
    system = 'muscular'
WHERE name ILIKE '%Hamstrings%';
UPDATE public.muscles
SET
    latin_name = COALESCE(latin_name, 'Musculus gastrocnemius'),
    primary_action = COALESCE(primary_action, 'Plantar flexion and knee flexion'),
    tkd_relevance = COALESCE(tkd_relevance, 'Footwork bounce, blitz lunges, and vertical jumping height in 540 and spinning kicks.'),
    system = 'muscular'
WHERE name ILIKE '%Calves (Gastrocnemius)%';
UPDATE public.muscles
SET
    latin_name = COALESCE(latin_name, 'Musculus tibialis anterior'),
    primary_action = COALESCE(primary_action, 'Dorsiflexion and inversion of foot'),
    tkd_relevance = COALESCE(tkd_relevance, 'Dorsiflexion to expose ball of foot (Ap Chuk) in front kicks and ankle stabilization.'),
    system = 'muscular'
WHERE name ILIKE '%Tibialis Anterior%';
UPDATE public.muscles
SET
    latin_name = COALESCE(latin_name, 'Musculus gluteus maximus'),
    primary_action = COALESCE(primary_action, 'Hip extension and external rotation'),
    tkd_relevance = COALESCE(tkd_relevance, 'Primary driver for Back Kick (Dwit Chagi), Side Kick (Yop Chagi), and stance stability.'),
    system = 'muscular'
WHERE name ILIKE '%Glutes%';
UPDATE public.muscles
SET
    latin_name = COALESCE(latin_name, 'Musculus iliopsoas'),
    primary_action = COALESCE(primary_action, 'Hip flexion and lumbar stabilization'),
    tkd_relevance = COALESCE(tkd_relevance, 'Chambering speed: bringing the knee to chest height instantaneously.'),
    system = 'muscular'
WHERE name ILIKE '%Hip Flexors%';
UPDATE public.muscles
SET
    latin_name = COALESCE(latin_name, 'Musculi adductores femoris'),
    primary_action = COALESCE(primary_action, 'Hip adduction and stabilization'),
    tkd_relevance = COALESCE(tkd_relevance, 'Centripetal stability and control during spinning techniques.'),
    system = 'muscular'
WHERE name ILIKE '%Adductors%';
UPDATE public.muscles
SET
    latin_name = COALESCE(latin_name, 'Musculus erector spinae'),
    primary_action = COALESCE(primary_action, 'Spine extension and posture maintenance'),
    tkd_relevance = COALESCE(tkd_relevance, 'Upright torso posture during kicks and spinal protection on dynamic rotation.'),
    system = 'muscular'
WHERE name ILIKE '%Lower Back (Erector Spinae)%';
UPDATE public.muscles
SET
    latin_name = COALESCE(latin_name, 'Musculus latissimus dorsi'),
    primary_action = COALESCE(primary_action, 'Humeral adduction, extension, and internal rotation'),
    tkd_relevance = COALESCE(tkd_relevance, 'Pulling back opposite reaction hand (Dangrim) to maximize rotational strike force.'),
    system = 'muscular'
WHERE name ILIKE '%Lats (Latissimus Dorsi)%';

-- Step 4: Insert full 376 BodyParts3D muscular concepts with mesh element bindings
INSERT INTO public.muscles (
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
    'Left inferior oblique',
    'Core',
    'BodyParts3D Concept: left inferior oblique (FMA49051)',
    'FMA49051',
    'FMA49051',
    '["FJ1294"]'::jsonb,
    '[[0.012558099999999999,1.5812612000000001,0.040479000000000015],[0.0419178,1.5976112,0.06631299999999998]]'::jsonb,
    'muscular',
    'left inferior oblique',
    '{"conceptId":"FMA49051","elements":["FJ1294"],"system":"muscular","bounds":[[0.012558099999999999,1.5812612000000001,0.040479000000000015],[0.0419178,1.5976112,0.06631299999999998]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left inferior rectus',
    'Muscular System',
    'BodyParts3D Concept: left inferior rectus (FMA49047)',
    'FMA49047',
    'FMA49047',
    '["FJ1295"]'::jsonb,
    '[[0.012115,1.5823312,0.019044999999999992],[0.0342923,1.6050112,0.060005]]'::jsonb,
    'muscular',
    'left inferior rectus',
    '{"conceptId":"FMA49047","elements":["FJ1295"],"system":"muscular","bounds":[[0.012115,1.5823312,0.019044999999999992],[0.0342923,1.6050112,0.060005]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left lateral rectus',
    'Muscular System',
    'BodyParts3D Concept: left lateral rectus (FMA49055)',
    'FMA49055',
    'FMA49055',
    '["FJ1304"]'::jsonb,
    '[[0.0163569,1.5912812,0.019108],[0.0427963,1.6088212,0.058727]]'::jsonb,
    'muscular',
    'left lateral rectus',
    '{"conceptId":"FMA49055","elements":["FJ1304"],"system":"muscular","bounds":[[0.0163569,1.5912812,0.019108],[0.0427963,1.6088212,0.058727]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left levator palpebrae superioris',
    'Head & Neck',
    'BodyParts3D Concept: left levator palpebrae superioris (FMA49049)',
    'FMA49049',
    'FMA49049',
    '["FJ1306"]'::jsonb,
    '[[0.0118402,1.5989912000000002,0.01957099999999999],[0.04197120000000001,1.6150712,0.06537700000000002]]'::jsonb,
    'muscular',
    'left levator palpebrae superioris',
    '{"conceptId":"FMA49049","elements":["FJ1306"],"system":"muscular","bounds":[[0.0118402,1.5989912000000002,0.01957099999999999],[0.04197120000000001,1.6150712,0.06537700000000002]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left medial rectus',
    'Muscular System',
    'BodyParts3D Concept: left medial rectus (FMA49057)',
    'FMA49057',
    'FMA49057',
    '["FJ1308"]'::jsonb,
    '[[0.0112401,1.5905212,0.020933999999999994],[0.0212375,1.6081412,0.06117900000000001]]'::jsonb,
    'muscular',
    'left medial rectus',
    '{"conceptId":"FMA49057","elements":["FJ1308"],"system":"muscular","bounds":[[0.0112401,1.5905212,0.020933999999999994],[0.0212375,1.6081412,0.06117900000000001]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left superior oblique',
    'Core',
    'BodyParts3D Concept: left superior oblique (FMA49053)',
    'FMA49053',
    'FMA49053',
    '["FJ1322"]'::jsonb,
    '[[0.011307000000000001,1.6014211999999999,0.022108000000000003],[0.0392835,1.6128012,0.06550899999999998]]'::jsonb,
    'muscular',
    'left superior oblique',
    '{"conceptId":"FMA49053","elements":["FJ1322"],"system":"muscular","bounds":[[0.011307000000000001,1.6014211999999999,0.022108000000000003],[0.0392835,1.6128012,0.06550899999999998]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left superior rectus',
    'Muscular System',
    'BodyParts3D Concept: left superior rectus (FMA49045)',
    'FMA49045',
    'FMA49045',
    '["FJ1323"]'::jsonb,
    '[[0.012585800000000001,1.6039112,0.021072999999999995],[0.035514699999999996,1.6107212,0.061615]]'::jsonb,
    'muscular',
    'left superior rectus',
    '{"conceptId":"FMA49045","elements":["FJ1323"],"system":"muscular","bounds":[[0.012585800000000001,1.6039112,0.021072999999999995],[0.035514699999999996,1.6107212,0.061615]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right inferior oblique',
    'Core',
    'BodyParts3D Concept: right inferior oblique (FMA49050)',
    'FMA49050',
    'FMA49050',
    '["FJ1345"]'::jsonb,
    '[[-0.0432376,1.5812512,0.04047100000000001],[-0.013864699999999999,1.5976112,0.06630699999999998]]'::jsonb,
    'muscular',
    'right inferior oblique',
    '{"conceptId":"FMA49050","elements":["FJ1345"],"system":"muscular","bounds":[[-0.0432376,1.5812512,0.04047100000000001],[-0.013864699999999999,1.5976112,0.06630699999999998]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right inferior rectus',
    'Muscular System',
    'BodyParts3D Concept: right inferior rectus (FMA49046)',
    'FMA49046',
    'FMA49046',
    '["FJ1346"]'::jsonb,
    '[[-0.035603,1.5823312,0.01904],[-0.0133962,1.6050212000000001,0.06]]'::jsonb,
    'muscular',
    'right inferior rectus',
    '{"conceptId":"FMA49046","elements":["FJ1346"],"system":"muscular","bounds":[[-0.035603,1.5823312,0.01904],[-0.0133962,1.6050212000000001,0.06]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right lateral rectus',
    'Muscular System',
    'BodyParts3D Concept: right lateral rectus (FMA49054)',
    'FMA49054',
    'FMA49054',
    '["FJ1355"]'::jsonb,
    '[[-0.0441111,1.5912912000000001,0.019096000000000002],[-0.017658100000000003,1.6088312,0.058732000000000006]]'::jsonb,
    'muscular',
    'right lateral rectus',
    '{"conceptId":"FMA49054","elements":["FJ1355"],"system":"muscular","bounds":[[-0.0441111,1.5912912000000001,0.019096000000000002],[-0.017658100000000003,1.6088312,0.058732000000000006]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right levator palpebrae superioris',
    'Head & Neck',
    'BodyParts3D Concept: right levator palpebrae superioris (FMA49048)',
    'FMA49048',
    'FMA49048',
    '["FJ1357"]'::jsonb,
    '[[-0.04329740000000001,1.5989711999999998,0.019558000000000006],[-0.0131642,1.6150812,0.06537899999999999]]'::jsonb,
    'muscular',
    'right levator palpebrae superioris',
    '{"conceptId":"FMA49048","elements":["FJ1357"],"system":"muscular","bounds":[[-0.04329740000000001,1.5989711999999998,0.019558000000000006],[-0.0131642,1.6150812,0.06537899999999999]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right medial rectus',
    'Muscular System',
    'BodyParts3D Concept: right medial rectus (FMA49056)',
    'FMA49056',
    'FMA49056',
    '["FJ1359"]'::jsonb,
    '[[-0.0225492,1.5905112000000001,0.020944000000000004],[-0.0125357,1.6081611999999998,0.06117699999999998]]'::jsonb,
    'muscular',
    'right medial rectus',
    '{"conceptId":"FMA49056","elements":["FJ1359"],"system":"muscular","bounds":[[-0.0225492,1.5905112000000001,0.020944000000000004],[-0.0125357,1.6081611999999998,0.06117699999999998]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right superior oblique',
    'Core',
    'BodyParts3D Concept: right superior oblique (FMA49052)',
    'FMA49052',
    'FMA49052',
    '["FJ1373"]'::jsonb,
    '[[-0.0405805,1.6014312,0.022072999999999995],[-0.0126366,1.6128012,0.06550999999999998]]'::jsonb,
    'muscular',
    'right superior oblique',
    '{"conceptId":"FMA49052","elements":["FJ1373"],"system":"muscular","bounds":[[-0.0405805,1.6014312,0.022072999999999995],[-0.0126366,1.6128012,0.06550999999999998]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right superior rectus',
    'Muscular System',
    'BodyParts3D Concept: right superior rectus (FMA49044)',
    'FMA49044',
    'FMA49044',
    '["FJ1374"]'::jsonb,
    '[[-0.036829900000000006,1.6039012,0.02105599999999999],[-0.0138793,1.6107311999999998,0.061616000000000004]]'::jsonb,
    'muscular',
    'right superior rectus',
    '{"conceptId":"FMA49044","elements":["FJ1374"],"system":"muscular","bounds":[[-0.036829900000000006,1.6039012,0.02105599999999999],[-0.0138793,1.6107311999999998,0.061616000000000004]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'First lumbrical of right foot',
    'Muscular System',
    'BodyParts3D Concept: first lumbrical of right foot (FMA37717)',
    'FMA37717',
    'FMA37717',
    '["FJ1383"]'::jsonb,
    '[[-0.113108,0.011046,0.0061350000000000016],[-0.0776868,0.03067700000000001,0.091523]]'::jsonb,
    'muscular',
    'first lumbrical of right foot',
    '{"conceptId":"FMA37717","elements":["FJ1383"],"system":"muscular","bounds":[[-0.113108,0.011046,0.0061350000000000016],[-0.0776868,0.03067700000000001,0.091523]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'First lumbrical of left foot',
    'Muscular System',
    'BodyParts3D Concept: first lumbrical of left foot (FMA37718)',
    'FMA37718',
    'FMA37718',
    '["FJ1383M"]'::jsonb,
    '[[0.0776868,0.011045900000000011,0.0061350000000000016],[0.113108,0.03067700000000001,0.091523]]'::jsonb,
    'muscular',
    'first lumbrical of left foot',
    '{"conceptId":"FMA37718","elements":["FJ1383M"],"system":"muscular","bounds":[[0.0776868,0.011045900000000011,0.0061350000000000016],[0.113108,0.03067700000000001,0.091523]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'First plantar interosseous of right foot',
    'Muscular System',
    'BodyParts3D Concept: first plantar interosseous of right foot (FMA37745)',
    'FMA37745',
    'FMA37745',
    '["FJ1384"]'::jsonb,
    '[[-0.13175,0.01541490000000001,0.03359899999999999],[-0.104791,0.038967100000000005,0.083143]]'::jsonb,
    'muscular',
    'first plantar interosseous of right foot',
    '{"conceptId":"FMA37745","elements":["FJ1384"],"system":"muscular","bounds":[[-0.13175,0.01541490000000001,0.03359899999999999],[-0.104791,0.038967100000000005,0.083143]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'First plantar interosseous of left foot',
    'Muscular System',
    'BodyParts3D Concept: first plantar interosseous of left foot (FMA37746)',
    'FMA37746',
    'FMA37746',
    '["FJ1384M"]'::jsonb,
    '[[0.104791,0.01541490000000001,0.03359899999999999],[0.13175,0.038967100000000005,0.083143]]'::jsonb,
    'muscular',
    'first plantar interosseous of left foot',
    '{"conceptId":"FMA37746","elements":["FJ1384M"],"system":"muscular","bounds":[[0.104791,0.01541490000000001,0.03359899999999999],[0.13175,0.038967100000000005,0.083143]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Second lumbrical of right foot',
    'Muscular System',
    'BodyParts3D Concept: second lumbrical of right foot (FMA37719)',
    'FMA37719',
    'FMA37719',
    '["FJ1385"]'::jsonb,
    '[[-0.129189,0.010520200000000007,0.021779999999999994],[-0.0885274,0.024685200000000004,0.08440199999999998]]'::jsonb,
    'muscular',
    'second lumbrical of right foot',
    '{"conceptId":"FMA37719","elements":["FJ1385"],"system":"muscular","bounds":[[-0.129189,0.010520200000000007,0.021779999999999994],[-0.0885274,0.024685200000000004,0.08440199999999998]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Second lumbrical of left foot',
    'Muscular System',
    'BodyParts3D Concept: second lumbrical of left foot (FMA37720)',
    'FMA37720',
    'FMA37720',
    '["FJ1385M"]'::jsonb,
    '[[0.0885274,0.010520200000000007,0.021779999999999994],[0.129189,0.024685200000000004,0.08440199999999998]]'::jsonb,
    'muscular',
    'second lumbrical of left foot',
    '{"conceptId":"FMA37720","elements":["FJ1385M"],"system":"muscular","bounds":[[0.0885274,0.010520200000000007,0.021779999999999994],[0.129189,0.024685200000000004,0.08440199999999998]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Second plantar interosseous of right foot',
    'Muscular System',
    'BodyParts3D Concept: second plantar interosseous of right foot (FMA37743)',
    'FMA37743',
    'FMA37743',
    '["FJ1386"]'::jsonb,
    '[[-0.138428,0.015803000000000005,0.02656],[-0.11108499999999999,0.0361018,0.07339199999999999]]'::jsonb,
    'muscular',
    'second plantar interosseous of right foot',
    '{"conceptId":"FMA37743","elements":["FJ1386"],"system":"muscular","bounds":[[-0.138428,0.015803000000000005,0.02656],[-0.11108499999999999,0.0361018,0.07339199999999999]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Second plantar interosseous of left foot',
    'Muscular System',
    'BodyParts3D Concept: second plantar interosseous of left foot (FMA37744)',
    'FMA37744',
    'FMA37744',
    '["FJ1386M"]'::jsonb,
    '[[0.11108499999999999,0.015803000000000005,0.02656],[0.138428,0.0361018,0.07339199999999999]]'::jsonb,
    'muscular',
    'second plantar interosseous of left foot',
    '{"conceptId":"FMA37744","elements":["FJ1386M"],"system":"muscular","bounds":[[0.11108499999999999,0.015803000000000005,0.02656],[0.138428,0.0361018,0.07339199999999999]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Third lumbrical of right foot',
    'Muscular System',
    'BodyParts3D Concept: third lumbrical of right foot (FMA37485)',
    'FMA37485',
    'FMA37485',
    '["FJ1387"]'::jsonb,
    '[[-0.137814,0.010068400000000005,0.018868999999999997],[-0.0940226,0.024286300000000004,0.073327]]'::jsonb,
    'muscular',
    'third lumbrical of right foot',
    '{"conceptId":"FMA37485","elements":["FJ1387"],"system":"muscular","bounds":[[-0.137814,0.010068400000000005,0.018868999999999997],[-0.0940226,0.024286300000000004,0.073327]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Third lumbrical of left foot',
    'Muscular System',
    'BodyParts3D Concept: third lumbrical of left foot (FMA37486)',
    'FMA37486',
    'FMA37486',
    '["FJ1387M"]'::jsonb,
    '[[0.0940226,0.010068400000000005,0.018868999999999997],[0.137814,0.024286300000000004,0.073327]]'::jsonb,
    'muscular',
    'third lumbrical of left foot',
    '{"conceptId":"FMA37486","elements":["FJ1387M"],"system":"muscular","bounds":[[0.0940226,0.010068400000000005,0.018868999999999997],[0.137814,0.024286300000000004,0.073327]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Third plantar interosseous of right foot',
    'Muscular System',
    'BodyParts3D Concept: third plantar interosseous of right foot (FMA37741)',
    'FMA37741',
    'FMA37741',
    '["FJ1388"]'::jsonb,
    '[[-0.153817,0.013653899999999997,0.015482999999999997],[-0.113547,0.0277931,0.059486999999999984]]'::jsonb,
    'muscular',
    'third plantar interosseous of right foot',
    '{"conceptId":"FMA37741","elements":["FJ1388"],"system":"muscular","bounds":[[-0.153817,0.013653899999999997,0.015482999999999997],[-0.113547,0.0277931,0.059486999999999984]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Third plantar interosseous of left foot',
    'Muscular System',
    'BodyParts3D Concept: third plantar interosseous of left foot (FMA37742)',
    'FMA37742',
    'FMA37742',
    '["FJ1388M"]'::jsonb,
    '[[0.113547,0.013653899999999997,0.015482999999999997],[0.153817,0.0277931,0.059486999999999984]]'::jsonb,
    'muscular',
    'third plantar interosseous of left foot',
    '{"conceptId":"FMA37742","elements":["FJ1388M"],"system":"muscular","bounds":[[0.113547,0.013653899999999997,0.015482999999999997],[0.153817,0.0277931,0.059486999999999984]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Fourth lumbrical of right foot',
    'Muscular System',
    'BodyParts3D Concept: fourth lumbrical of right foot (FMA37483)',
    'FMA37483',
    'FMA37483',
    '["FJ1389"]'::jsonb,
    '[[-0.145769,0.0102965,0.017540999999999987],[-0.09974899999999999,0.024380000000000006,0.05824499999999999]]'::jsonb,
    'muscular',
    'fourth lumbrical of right foot',
    '{"conceptId":"FMA37483","elements":["FJ1389"],"system":"muscular","bounds":[[-0.145769,0.0102965,0.017540999999999987],[-0.09974899999999999,0.024380000000000006,0.05824499999999999]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Fourth lumbrical of left foot',
    'Muscular System',
    'BodyParts3D Concept: fourth lumbrical of left foot (FMA37484)',
    'FMA37484',
    'FMA37484',
    '["FJ1389M"]'::jsonb,
    '[[0.09974899999999999,0.0102965,0.017540999999999987],[0.145769,0.024380000000000006,0.05824499999999999]]'::jsonb,
    'muscular',
    'fourth lumbrical of left foot',
    '{"conceptId":"FMA37484","elements":["FJ1389M"],"system":"muscular","bounds":[[0.09974899999999999,0.0102965,0.017540999999999987],[0.145769,0.024380000000000006,0.05824499999999999]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Abductor digiti minimi of right foot',
    'Muscular System',
    'BodyParts3D Concept: abductor digiti minimi of right foot (FMA37463)',
    'FMA37463',
    'FMA37463',
    '["FJ1390"]'::jsonb,
    '[[-0.15460400000000002,0.00839680000000001,-0.056267000000000005],[-0.0613968,0.024354800000000003,0.05282300000000001]]'::jsonb,
    'muscular',
    'abductor digiti minimi of right foot',
    '{"conceptId":"FMA37463","elements":["FJ1390"],"system":"muscular","bounds":[[-0.15460400000000002,0.00839680000000001,-0.056267000000000005],[-0.0613968,0.024354800000000003,0.05282300000000001]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Abductor digiti minimi of left foot',
    'Muscular System',
    'BodyParts3D Concept: abductor digiti minimi of left foot (FMA37464)',
    'FMA37464',
    'FMA37464',
    '["FJ1390M"]'::jsonb,
    '[[0.0613968,0.00839680000000001,-0.056267000000000005],[0.15460400000000002,0.024354800000000003,0.05282300000000001]]'::jsonb,
    'muscular',
    'abductor digiti minimi of left foot',
    '{"conceptId":"FMA37464","elements":["FJ1390M"],"system":"muscular","bounds":[[0.0613968,0.00839680000000001,-0.056267000000000005],[0.15460400000000002,0.024354800000000003,0.05282300000000001]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Flexor digiti minimi brevis of right foot',
    'Muscular System',
    'BodyParts3D Concept: flexor digiti minimi brevis of right foot (FMA37471)',
    'FMA37471',
    'FMA37471',
    '["FJ1391"]'::jsonb,
    '[[-0.155761,0.007056500000000007,-0.0018058000000000102],[-0.109225,0.024862100000000005,0.059947]]'::jsonb,
    'muscular',
    'flexor digiti minimi brevis of right foot',
    '{"conceptId":"FMA37471","elements":["FJ1391"],"system":"muscular","bounds":[[-0.155761,0.007056500000000007,-0.0018058000000000102],[-0.109225,0.024862100000000005,0.059947]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Flexor digiti minimi brevis of left foot',
    'Muscular System',
    'BodyParts3D Concept: flexor digiti minimi brevis of left foot (FMA37472)',
    'FMA37472',
    'FMA37472',
    '["FJ1391M"]'::jsonb,
    '[[0.109225,0.007056500000000007,-0.0018058000000000102],[0.155761,0.024862100000000005,0.059947]]'::jsonb,
    'muscular',
    'flexor digiti minimi brevis of left foot',
    '{"conceptId":"FMA37472","elements":["FJ1391M"],"system":"muscular","bounds":[[0.109225,0.007056500000000007,-0.0018058000000000102],[0.155761,0.024862100000000005,0.059947]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Lateral head of right flexor hallucis brevis',
    'Muscular System',
    'BodyParts3D Concept: lateral head of right flexor hallucis brevis (FMA45973)',
    'FMA45973',
    'FMA45973',
    '["FJ1393"]'::jsonb,
    '[[-0.10509500000000001,0.007061799999999993,0.018243999999999996],[-0.0684896,0.04435870000000001,0.09523099999999998]]'::jsonb,
    'muscular',
    'lateral head of right flexor hallucis brevis',
    '{"conceptId":"FMA45973","elements":["FJ1393"],"system":"muscular","bounds":[[-0.10509500000000001,0.007061799999999993,0.018243999999999996],[-0.0684896,0.04435870000000001,0.09523099999999998]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Lateral head of left flexor hallucis brevis',
    'Muscular System',
    'BodyParts3D Concept: lateral head of left flexor hallucis brevis (FMA45974)',
    'FMA45974',
    'FMA45974',
    '["FJ1393M"]'::jsonb,
    '[[0.0684896,0.007061799999999993,0.018243999999999996],[0.10509500000000001,0.04435870000000001,0.09523099999999998]]'::jsonb,
    'muscular',
    'lateral head of left flexor hallucis brevis',
    '{"conceptId":"FMA45974","elements":["FJ1393M"],"system":"muscular","bounds":[[0.0684896,0.007061799999999993,0.018243999999999996],[0.10509500000000001,0.04435870000000001,0.09523099999999998]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Lateral head of right gastrocnemius',
    'Lower Body',
    'BodyParts3D Concept: lateral head of right gastrocnemius (FMA45960)',
    'FMA45960',
    'FMA45960',
    '["FJ1394"]'::jsonb,
    '[[-0.11699200000000001,0.2109122,-0.09419089],[-0.061167000000000006,0.5013722,-0.019349400000000003]]'::jsonb,
    'muscular',
    'lateral head of right gastrocnemius',
    '{"conceptId":"FMA45960","elements":["FJ1394"],"system":"muscular","bounds":[[-0.11699200000000001,0.2109122,-0.09419089],[-0.061167000000000006,0.5013722,-0.019349400000000003]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Lateral head of left gastrocnemius',
    'Lower Body',
    'BodyParts3D Concept: lateral head of left gastrocnemius (FMA45961)',
    'FMA45961',
    'FMA45961',
    '["FJ1394M"]'::jsonb,
    '[[0.061167000000000006,0.2109122,-0.09419089],[0.11699200000000001,0.5013722,-0.019349400000000003]]'::jsonb,
    'muscular',
    'lateral head of left gastrocnemius',
    '{"conceptId":"FMA45961","elements":["FJ1394M"],"system":"muscular","bounds":[[0.061167000000000006,0.2109122,-0.09419089],[0.11699200000000001,0.5013722,-0.019349400000000003]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Long head of right biceps femoris',
    'Lower Body',
    'BodyParts3D Concept: long head of right biceps femoris (FMA45888)',
    'FMA45888',
    'FMA45888',
    '["FJ1395"]'::jsonb,
    '[[-0.126642,0.4060162,-0.08169040000000001],[-0.0486928,0.8428642000000001,-0.02781220000000001]]'::jsonb,
    'muscular',
    'long head of right biceps femoris',
    '{"conceptId":"FMA45888","elements":["FJ1395"],"system":"muscular","bounds":[[-0.126642,0.4060162,-0.08169040000000001],[-0.0486928,0.8428642000000001,-0.02781220000000001]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Long head of left biceps femoris',
    'Lower Body',
    'BodyParts3D Concept: long head of left biceps femoris (FMA45889)',
    'FMA45889',
    'FMA45889',
    '["FJ1395M"]'::jsonb,
    '[[0.048692700000000005,0.4060162,-0.0816905],[0.126642,0.8428642000000001,-0.02781220000000001]]'::jsonb,
    'muscular',
    'long head of left biceps femoris',
    '{"conceptId":"FMA45889","elements":["FJ1395M"],"system":"muscular","bounds":[[0.048692700000000005,0.4060162,-0.0816905],[0.126642,0.8428642000000001,-0.02781220000000001]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Medial head of right flexor hallucis brevis',
    'Muscular System',
    'BodyParts3D Concept: medial head of right flexor hallucis brevis (FMA45971)',
    'FMA45971',
    'FMA45971',
    '["FJ1396"]'::jsonb,
    '[[-0.0952413,0.009092500000000003,0.018075999999999995],[-0.0681456,0.046851300000000005,0.09500600000000001]]'::jsonb,
    'muscular',
    'medial head of right flexor hallucis brevis',
    '{"conceptId":"FMA45971","elements":["FJ1396"],"system":"muscular","bounds":[[-0.0952413,0.009092500000000003,0.018075999999999995],[-0.0681456,0.046851300000000005,0.09500600000000001]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Medial head of left flexor hallucis brevis',
    'Muscular System',
    'BodyParts3D Concept: medial head of left flexor hallucis brevis (FMA45972)',
    'FMA45972',
    'FMA45972',
    '["FJ1396M"]'::jsonb,
    '[[0.0681456,0.009092500000000003,0.018075999999999995],[0.0952413,0.046851300000000005,0.09500600000000001]]'::jsonb,
    'muscular',
    'medial head of left flexor hallucis brevis',
    '{"conceptId":"FMA45972","elements":["FJ1396M"],"system":"muscular","bounds":[[0.0681456,0.009092500000000003,0.018075999999999995],[0.0952413,0.046851300000000005,0.09500600000000001]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Medial head of right gastrocnemius',
    'Lower Body',
    'BodyParts3D Concept: medial head of right gastrocnemius (FMA45957)',
    'FMA45957',
    'FMA45957',
    '["FJ1397"]'::jsonb,
    '[[-0.0742357,0.20094420000000002,-0.0863386],[-0.0217597,0.5102132,-0.00730660000000001]]'::jsonb,
    'muscular',
    'medial head of right gastrocnemius',
    '{"conceptId":"FMA45957","elements":["FJ1397"],"system":"muscular","bounds":[[-0.0742357,0.20094420000000002,-0.0863386],[-0.0217597,0.5102132,-0.00730660000000001]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Medial head of left gastrocnemius',
    'Lower Body',
    'BodyParts3D Concept: medial head of left gastrocnemius (FMA45958)',
    'FMA45958',
    'FMA45958',
    '["FJ1397M"]'::jsonb,
    '[[0.0217597,0.20094420000000002,-0.0863386],[0.0742358,0.5102132,-0.00730660000000001]]'::jsonb,
    'muscular',
    'medial head of left gastrocnemius',
    '{"conceptId":"FMA45958","elements":["FJ1397M"],"system":"muscular","bounds":[[0.0217597,0.20094420000000002,-0.0863386],[0.0742358,0.5102132,-0.00730660000000001]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Oblique head of right adductor hallucis',
    'Lower Body',
    'BodyParts3D Concept: oblique head of right adductor hallucis (FMA46018)',
    'FMA46018',
    'FMA46018',
    '["FJ1398"]'::jsonb,
    '[[-0.113134,0.012443400000000007,0.0072419999999999984],[-0.09530240000000001,0.04135930000000001,0.07363999999999998]]'::jsonb,
    'muscular',
    'oblique head of right adductor hallucis',
    '{"conceptId":"FMA46018","elements":["FJ1398"],"system":"muscular","bounds":[[-0.113134,0.012443400000000007,0.0072419999999999984],[-0.09530240000000001,0.04135930000000001,0.07363999999999998]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Oblique head of left adductor hallucis',
    'Lower Body',
    'BodyParts3D Concept: oblique head of left adductor hallucis (FMA46019)',
    'FMA46019',
    'FMA46019',
    '["FJ1398M"]'::jsonb,
    '[[0.09530240000000001,0.012443400000000007,0.0072419999999999984],[0.113134,0.04135930000000001,0.07363999999999998]]'::jsonb,
    'muscular',
    'oblique head of left adductor hallucis',
    '{"conceptId":"FMA46019","elements":["FJ1398M"],"system":"muscular","bounds":[[0.09530240000000001,0.012443400000000007,0.0072419999999999984],[0.113134,0.04135930000000001,0.07363999999999998]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Opponens digiti minimi of right foot',
    'Muscular System',
    'BodyParts3D Concept: opponens digiti minimi of right foot (FMA86034)',
    'FMA86034',
    'FMA86034',
    '["FJ1399"]'::jsonb,
    '[[-0.13911500000000002,0.013698000000000002,-0.0008664000000000033],[-0.109672,0.024764900000000006,0.035744]]'::jsonb,
    'muscular',
    'opponens digiti minimi of right foot',
    '{"conceptId":"FMA86034","elements":["FJ1399"],"system":"muscular","bounds":[[-0.13911500000000002,0.013698000000000002,-0.0008664000000000033],[-0.109672,0.024764900000000006,0.035744]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Opponens digiti minimi of left foot',
    'Muscular System',
    'BodyParts3D Concept: opponens digiti minimi of left foot (FMA86035)',
    'FMA86035',
    'FMA86035',
    '["FJ1399M"]'::jsonb,
    '[[0.109672,0.013698000000000002,-0.0008664000000000033],[0.13911500000000002,0.024764900000000006,0.035744]]'::jsonb,
    'muscular',
    'opponens digiti minimi of left foot',
    '{"conceptId":"FMA86035","elements":["FJ1399M"],"system":"muscular","bounds":[[0.109672,0.013698000000000002,-0.0008664000000000033],[0.13911500000000002,0.024764900000000006,0.035744]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right abductor hallucis',
    'Muscular System',
    'BodyParts3D Concept: right abductor hallucis (FMA37459)',
    'FMA37459',
    'FMA37459',
    '["FJ1400"]'::jsonb,
    '[[-0.08903470000000001,0.01242760000000001,-0.042804600000000005],[-0.053871800000000004,0.03846080000000001,0.09343299999999999]]'::jsonb,
    'muscular',
    'right abductor hallucis',
    '{"conceptId":"FMA37459","elements":["FJ1400"],"system":"muscular","bounds":[[-0.08903470000000001,0.01242760000000001,-0.042804600000000005],[-0.053871800000000004,0.03846080000000001,0.09343299999999999]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left abductor hallucis',
    'Muscular System',
    'BodyParts3D Concept: left abductor hallucis (FMA37460)',
    'FMA37460',
    'FMA37460',
    '["FJ1400M"]'::jsonb,
    '[[0.0538719,0.01242760000000001,-0.042804600000000005],[0.08903470000000001,0.03846080000000001,0.09343299999999999]]'::jsonb,
    'muscular',
    'left abductor hallucis',
    '{"conceptId":"FMA37460","elements":["FJ1400M"],"system":"muscular","bounds":[[0.0538719,0.01242760000000001,-0.042804600000000005],[0.08903470000000001,0.03846080000000001,0.09343299999999999]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right adductor brevis',
    'Lower Body',
    'BodyParts3D Concept: right adductor brevis (FMA22452)',
    'FMA22452',
    'FMA22452',
    '["FJ1401"]'::jsonb,
    '[[-0.0984602,0.6798322000000001,-0.020291100000000006],[-0.0230962,0.8766642000000001,0.026519999999999988]]'::jsonb,
    'muscular',
    'right adductor brevis',
    '{"conceptId":"FMA22452","elements":["FJ1401"],"system":"muscular","bounds":[[-0.0984602,0.6798322000000001,-0.020291100000000006],[-0.0230962,0.8766642000000001,0.026519999999999988]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left adductor brevis',
    'Lower Body',
    'BodyParts3D Concept: left adductor brevis (FMA22454)',
    'FMA22454',
    'FMA22454',
    '["FJ1401M"]'::jsonb,
    '[[0.0230962,0.6798322000000001,-0.020291100000000006],[0.0984602,0.8766632000000001,0.026519999999999988]]'::jsonb,
    'muscular',
    'left adductor brevis',
    '{"conceptId":"FMA22454","elements":["FJ1401M"],"system":"muscular","bounds":[[0.0230962,0.6798322000000001,-0.020291100000000006],[0.0984602,0.8766632000000001,0.026519999999999988]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right adductor longus',
    'Lower Body',
    'BodyParts3D Concept: right adductor longus (FMA22456)',
    'FMA22456',
    'FMA22456',
    '["FJ1402"]'::jsonb,
    '[[-0.0941022,0.5883152,-0.0106242],[-0.0170401,0.8777762,0.036972000000000005]]'::jsonb,
    'muscular',
    'right adductor longus',
    '{"conceptId":"FMA22456","elements":["FJ1402"],"system":"muscular","bounds":[[-0.0941022,0.5883152,-0.0106242],[-0.0170401,0.8777762,0.036972000000000005]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left adductor longus',
    'Lower Body',
    'BodyParts3D Concept: left adductor longus (FMA22457)',
    'FMA22457',
    'FMA22457',
    '["FJ1402M"]'::jsonb,
    '[[0.0170402,0.5883152,-0.0106242],[0.0941022,0.8777762,0.036971000000000004]]'::jsonb,
    'muscular',
    'left adductor longus',
    '{"conceptId":"FMA22457","elements":["FJ1402M"],"system":"muscular","bounds":[[0.0170402,0.5883152,-0.0106242],[0.0941022,0.8777762,0.036971000000000004]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right adductor magnus',
    'Lower Body',
    'BodyParts3D Concept: right adductor magnus (FMA22459)',
    'FMA22459',
    'FMA22459',
    '["FJ1403"]'::jsonb,
    '[[-0.112212,0.4580762,-0.045559],[-0.0136994,0.8554402,0.013020999999999991]]'::jsonb,
    'muscular',
    'right adductor magnus',
    '{"conceptId":"FMA22459","elements":["FJ1403"],"system":"muscular","bounds":[[-0.112212,0.4580762,-0.045559],[-0.0136994,0.8554402,0.013020999999999991]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left adductor magnus',
    'Lower Body',
    'BodyParts3D Concept: left adductor magnus (FMA22460)',
    'FMA22460',
    'FMA22460',
    '["FJ1403M"]'::jsonb,
    '[[0.0136994,0.4580762,-0.045559],[0.112213,0.8554402,0.01301999999999999]]'::jsonb,
    'muscular',
    'left adductor magnus',
    '{"conceptId":"FMA22460","elements":["FJ1403M"],"system":"muscular","bounds":[[0.0136994,0.4580762,-0.045559],[0.112213,0.8554402,0.01301999999999999]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right adductor minimus',
    'Lower Body',
    'BodyParts3D Concept: right adductor minimus (FMA43886)',
    'FMA43886',
    'FMA43886',
    '["FJ1404"]'::jsonb,
    '[[-0.101256,0.7428442,-0.029528700000000005],[-0.0158421,0.8641372,0.015569999999999987]]'::jsonb,
    'muscular',
    'right adductor minimus',
    '{"conceptId":"FMA43886","elements":["FJ1404"],"system":"muscular","bounds":[[-0.101256,0.7428442,-0.029528700000000005],[-0.0158421,0.8641372,0.015569999999999987]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left adductor minimus',
    'Lower Body',
    'BodyParts3D Concept: left adductor minimus (FMA43887)',
    'FMA43887',
    'FMA43887',
    '["FJ1404M"]'::jsonb,
    '[[0.015842000000000002,0.7428442,-0.029528700000000005],[0.101256,0.8641372,0.015569999999999987]]'::jsonb,
    'muscular',
    'left adductor minimus',
    '{"conceptId":"FMA43887","elements":["FJ1404M"],"system":"muscular","bounds":[[0.015842000000000002,0.7428442,-0.029528700000000005],[0.101256,0.8641372,0.015569999999999987]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right extensor digitorum longus',
    'Upper Body',
    'BodyParts3D Concept: right extensor digitorum longus (FMA22548)',
    'FMA22548',
    'FMA22548',
    '["FJ1406"]'::jsonb,
    '[[-0.166069,0.011048600000000006,-0.0416822],[-0.08934829999999999,0.4374672,0.123662]]'::jsonb,
    'muscular',
    'right extensor digitorum longus',
    '{"conceptId":"FMA22548","elements":["FJ1406"],"system":"muscular","bounds":[[-0.166069,0.011048600000000006,-0.0416822],[-0.08934829999999999,0.4374672,0.123662]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left extensor digitorum longus',
    'Upper Body',
    'BodyParts3D Concept: left extensor digitorum longus (FMA22549)',
    'FMA22549',
    'FMA22549',
    '["FJ1406M"]'::jsonb,
    '[[0.08934829999999999,0.011048600000000006,-0.0416822],[0.166069,0.4374672,0.123662]]'::jsonb,
    'muscular',
    'left extensor digitorum longus',
    '{"conceptId":"FMA22549","elements":["FJ1406M"],"system":"muscular","bounds":[[0.08934829999999999,0.011048600000000006,-0.0416822],[0.166069,0.4374672,0.123662]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right extensor hallucis brevis',
    'Muscular System',
    'BodyParts3D Concept: right extensor hallucis brevis (FMA51144)',
    'FMA51144',
    'FMA51144',
    '["FJ1407"]'::jsonb,
    '[[-0.10434,0.02475150000000001,-0.021865499999999996],[-0.0903251,0.07067676,0.09803700000000001]]'::jsonb,
    'muscular',
    'right extensor hallucis brevis',
    '{"conceptId":"FMA51144","elements":["FJ1407"],"system":"muscular","bounds":[[-0.10434,0.02475150000000001,-0.021865499999999996],[-0.0903251,0.07067676,0.09803700000000001]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left extensor hallucis brevis',
    'Muscular System',
    'BodyParts3D Concept: left extensor hallucis brevis (FMA51145)',
    'FMA51145',
    'FMA51145',
    '["FJ1407M"]'::jsonb,
    '[[0.0903251,0.02475150000000001,-0.021865499999999996],[0.10434,0.07067676,0.09803700000000001]]'::jsonb,
    'muscular',
    'left extensor hallucis brevis',
    '{"conceptId":"FMA51145","elements":["FJ1407M"],"system":"muscular","bounds":[[0.0903251,0.02475150000000001,-0.021865499999999996],[0.10434,0.07067676,0.09803700000000001]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right extensor hallucis longus',
    'Muscular System',
    'BodyParts3D Concept: right extensor hallucis longus (FMA22546)',
    'FMA22546',
    'FMA22546',
    '["FJ1408"]'::jsonb,
    '[[-0.107598,0.021470500000000003,-0.03438240000000001],[-0.0799472,0.2939442,0.10947499999999999]]'::jsonb,
    'muscular',
    'right extensor hallucis longus',
    '{"conceptId":"FMA22546","elements":["FJ1408"],"system":"muscular","bounds":[[-0.107598,0.021470500000000003,-0.03438240000000001],[-0.0799472,0.2939442,0.10947499999999999]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left extensor hallucis longus',
    'Muscular System',
    'BodyParts3D Concept: left extensor hallucis longus (FMA22547)',
    'FMA22547',
    'FMA22547',
    '["FJ1408M"]'::jsonb,
    '[[0.0799472,0.021470500000000003,-0.03438240000000001],[0.107598,0.2939442,0.10947499999999999]]'::jsonb,
    'muscular',
    'left extensor hallucis longus',
    '{"conceptId":"FMA22547","elements":["FJ1408M"],"system":"muscular","bounds":[[0.0799472,0.021470500000000003,-0.03438240000000001],[0.107598,0.2939442,0.10947499999999999]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right flexor accessorius',
    'Muscular System',
    'BodyParts3D Concept: right flexor accessorius (FMA37465)',
    'FMA37465',
    'FMA37465',
    '["FJ1412"]'::jsonb,
    '[[-0.10916100000000001,0.015667500000000008,-0.04973910000000001],[-0.0600618,0.031670500000000004,0.018944000000000003]]'::jsonb,
    'muscular',
    'right flexor accessorius',
    '{"conceptId":"FMA37465","elements":["FJ1412"],"system":"muscular","bounds":[[-0.10916100000000001,0.015667500000000008,-0.04973910000000001],[-0.0600618,0.031670500000000004,0.018944000000000003]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left flexor accessorius',
    'Muscular System',
    'BodyParts3D Concept: left flexor accessorius (FMA37466)',
    'FMA37466',
    'FMA37466',
    '["FJ1412M"]'::jsonb,
    '[[0.0600618,0.015667500000000008,-0.04973910000000001],[0.10916100000000001,0.031670500000000004,0.018944000000000003]]'::jsonb,
    'muscular',
    'left flexor accessorius',
    '{"conceptId":"FMA37466","elements":["FJ1412M"],"system":"muscular","bounds":[[0.0600618,0.015667500000000008,-0.04973910000000001],[0.10916100000000001,0.031670500000000004,0.018944000000000003]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right flexor digitorum brevis',
    'Upper Body',
    'BodyParts3D Concept: right flexor digitorum brevis (FMA37461)',
    'FMA37461',
    'FMA37461',
    '["FJ1413"]'::jsonb,
    '[[-0.164326,0.005301100000000003,-0.054374200000000004],[-0.058602600000000005,0.024185700000000004,0.118194]]'::jsonb,
    'muscular',
    'right flexor digitorum brevis',
    '{"conceptId":"FMA37461","elements":["FJ1413"],"system":"muscular","bounds":[[-0.164326,0.005301100000000003,-0.054374200000000004],[-0.058602600000000005,0.024185700000000004,0.118194]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left flexor digitorum brevis',
    'Upper Body',
    'BodyParts3D Concept: left flexor digitorum brevis (FMA37462)',
    'FMA37462',
    'FMA37462',
    '["FJ1413M"]'::jsonb,
    '[[0.058602600000000005,0.005301100000000003,-0.054374200000000004],[0.164326,0.024185700000000004,0.118194]]'::jsonb,
    'muscular',
    'left flexor digitorum brevis',
    '{"conceptId":"FMA37462","elements":["FJ1413M"],"system":"muscular","bounds":[[0.058602600000000005,0.005301100000000003,-0.054374200000000004],[0.164326,0.024185700000000004,0.118194]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right flexor digitorum longus',
    'Upper Body',
    'BodyParts3D Concept: right flexor digitorum longus (FMA65016)',
    'FMA65016',
    'FMA65016',
    '["FJ1414"]'::jsonb,
    '[[-0.165771,0.006129399999999993,-0.04391980000000001],[-0.0393682,0.36926319999999996,0.126454]]'::jsonb,
    'muscular',
    'right flexor digitorum longus',
    '{"conceptId":"FMA65016","elements":["FJ1414"],"system":"muscular","bounds":[[-0.165771,0.006129399999999993,-0.04391980000000001],[-0.0393682,0.36926319999999996,0.126454]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left flexor digitorum longus',
    'Upper Body',
    'BodyParts3D Concept: left flexor digitorum longus (FMA65017)',
    'FMA65017',
    'FMA65017',
    '["FJ1414M"]'::jsonb,
    '[[0.0393682,0.006129399999999993,-0.04391980000000001],[0.165771,0.36926319999999996,0.126454]]'::jsonb,
    'muscular',
    'left flexor digitorum longus',
    '{"conceptId":"FMA65017","elements":["FJ1414M"],"system":"muscular","bounds":[[0.0393682,0.006129399999999993,-0.04391980000000001],[0.165771,0.36926319999999996,0.126454]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right flexor hallucis longus',
    'Muscular System',
    'BodyParts3D Concept: right flexor hallucis longus (FMA65014)',
    'FMA65014',
    'FMA65014',
    '["FJ1415"]'::jsonb,
    '[[-0.117846,0.006916800000000001,-0.05512160000000001],[-0.0521983,0.3297182,0.122611]]'::jsonb,
    'muscular',
    'right flexor hallucis longus',
    '{"conceptId":"FMA65014","elements":["FJ1415"],"system":"muscular","bounds":[[-0.117846,0.006916800000000001,-0.05512160000000001],[-0.0521983,0.3297182,0.122611]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left flexor hallucis longus',
    'Muscular System',
    'BodyParts3D Concept: left flexor hallucis longus (FMA65015)',
    'FMA65015',
    'FMA65015',
    '["FJ1415M"]'::jsonb,
    '[[0.0521983,0.006916800000000001,-0.05512160000000001],[0.117846,0.3297182,0.122611]]'::jsonb,
    'muscular',
    'left flexor hallucis longus',
    '{"conceptId":"FMA65015","elements":["FJ1415M"],"system":"muscular","bounds":[[0.0521983,0.006916800000000001,-0.05512160000000001],[0.117846,0.3297182,0.122611]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right gemellus inferior',
    'Muscular System',
    'BodyParts3D Concept: right gemellus inferior (FMA22336)',
    'FMA22336',
    'FMA22336',
    '["FJ1416"]'::jsonb,
    '[[-0.125865,0.8590122,-0.0761178],[-0.0555291,0.8809902000000001,-0.022174899999999997]]'::jsonb,
    'muscular',
    'right gemellus inferior',
    '{"conceptId":"FMA22336","elements":["FJ1416"],"system":"muscular","bounds":[[-0.125865,0.8590122,-0.0761178],[-0.0555291,0.8809902000000001,-0.022174899999999997]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left gemellus inferior',
    'Muscular System',
    'BodyParts3D Concept: left gemellus inferior (FMA22337)',
    'FMA22337',
    'FMA22337',
    '["FJ1416M"]'::jsonb,
    '[[0.0555291,0.8590122,-0.0761178],[0.125865,0.8809902000000001,-0.022174899999999997]]'::jsonb,
    'muscular',
    'left gemellus inferior',
    '{"conceptId":"FMA22337","elements":["FJ1416M"],"system":"muscular","bounds":[[0.0555291,0.8590122,-0.0761178],[0.125865,0.8809902000000001,-0.022174899999999997]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right gemellus superior',
    'Muscular System',
    'BodyParts3D Concept: right gemellus superior (FMA22334)',
    'FMA22334',
    'FMA22334',
    '["FJ1417"]'::jsonb,
    '[[-0.125191,0.8762932000000001,-0.06683030000000001],[-0.0453349,0.9032992000000001,-0.021958400000000003]]'::jsonb,
    'muscular',
    'right gemellus superior',
    '{"conceptId":"FMA22334","elements":["FJ1417"],"system":"muscular","bounds":[[-0.125191,0.8762932000000001,-0.06683030000000001],[-0.0453349,0.9032992000000001,-0.021958400000000003]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left gemellus superior',
    'Muscular System',
    'BodyParts3D Concept: left gemellus superior (FMA22335)',
    'FMA22335',
    'FMA22335',
    '["FJ1417M"]'::jsonb,
    '[[0.0453349,0.8762932000000001,-0.06683030000000001],[0.125191,0.9032992000000001,-0.021958400000000003]]'::jsonb,
    'muscular',
    'left gemellus superior',
    '{"conceptId":"FMA22335","elements":["FJ1417M"],"system":"muscular","bounds":[[0.0453349,0.8762932000000001,-0.06683030000000001],[0.125191,0.9032992000000001,-0.021958400000000003]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right gluteus maximus',
    'Lower Body',
    'BodyParts3D Concept: right gluteus maximus (FMA22328)',
    'FMA22328',
    'FMA22328',
    '["FJ1418"]'::jsonb,
    '[[-0.145401,0.7458562000000001,-0.11986630000000001],[0.00152091,1.0106682,-0.021988500000000008]]'::jsonb,
    'muscular',
    'right gluteus maximus',
    '{"conceptId":"FMA22328","elements":["FJ1418"],"system":"muscular","bounds":[[-0.145401,0.7458562000000001,-0.11986630000000001],[0.00152091,1.0106682,-0.021988500000000008]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left gluteus maximus',
    'Lower Body',
    'BodyParts3D Concept: left gluteus maximus (FMA22329)',
    'FMA22329',
    'FMA22329',
    '["FJ1418M"]'::jsonb,
    '[[-0.00152091,0.7458562000000001,-0.11986630000000001],[0.145401,1.0106682,-0.021988500000000008]]'::jsonb,
    'muscular',
    'left gluteus maximus',
    '{"conceptId":"FMA22329","elements":["FJ1418M"],"system":"muscular","bounds":[[-0.00152091,0.7458562000000001,-0.11986630000000001],[0.145401,1.0106682,-0.021988500000000008]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right gluteus medius',
    'Lower Body',
    'BodyParts3D Concept: right gluteus medius (FMA22330)',
    'FMA22330',
    'FMA22330',
    '["FJ1419"]'::jsonb,
    '[[-0.14973599999999998,0.8668542000000001,-0.08306580000000001],[-0.0595963,1.0290142,0.0019979999999999998]]'::jsonb,
    'muscular',
    'right gluteus medius',
    '{"conceptId":"FMA22330","elements":["FJ1419"],"system":"muscular","bounds":[[-0.14973599999999998,0.8668542000000001,-0.08306580000000001],[-0.0595963,1.0290142,0.0019979999999999998]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left gluteus medius',
    'Lower Body',
    'BodyParts3D Concept: left gluteus medius (FMA22331)',
    'FMA22331',
    'FMA22331',
    '["FJ1419M"]'::jsonb,
    '[[0.0595963,0.8668542000000001,-0.08306580000000001],[0.149735,1.0290142,0.0019979999999999998]]'::jsonb,
    'muscular',
    'left gluteus medius',
    '{"conceptId":"FMA22331","elements":["FJ1419M"],"system":"muscular","bounds":[[0.0595963,0.8668542000000001,-0.08306580000000001],[0.149735,1.0290142,0.0019979999999999998]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right gluteus minimus',
    'Lower Body',
    'BodyParts3D Concept: right gluteus minimus (FMA22332)',
    'FMA22332',
    'FMA22332',
    '["FJ1420"]'::jsonb,
    '[[-0.14513700000000002,0.8613912,-0.053628100000000005],[-0.0677084,1.0013662,0.0022770000000000012]]'::jsonb,
    'muscular',
    'right gluteus minimus',
    '{"conceptId":"FMA22332","elements":["FJ1420"],"system":"muscular","bounds":[[-0.14513700000000002,0.8613912,-0.053628100000000005],[-0.0677084,1.0013662,0.0022770000000000012]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left gluteus minimus',
    'Lower Body',
    'BodyParts3D Concept: left gluteus minimus (FMA22333)',
    'FMA22333',
    'FMA22333',
    '["FJ1420M"]'::jsonb,
    '[[0.0677084,0.8613912,-0.053628100000000005],[0.14513700000000002,1.0013662,0.0022770000000000012]]'::jsonb,
    'muscular',
    'left gluteus minimus',
    '{"conceptId":"FMA22333","elements":["FJ1420M"],"system":"muscular","bounds":[[0.0677084,0.8613912,-0.053628100000000005],[0.14513700000000002,1.0013662,0.0022770000000000012]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right gracilis',
    'Lower Body',
    'BodyParts3D Concept: right gracilis (FMA43883)',
    'FMA43883',
    'FMA43883',
    '["FJ1421"]'::jsonb,
    '[[-0.0704152,0.36112520000000004,-0.034649600000000016],[-0.0120663,0.8756742000000001,0.03253299999999998]]'::jsonb,
    'muscular',
    'right gracilis',
    '{"conceptId":"FMA43883","elements":["FJ1421"],"system":"muscular","bounds":[[-0.0704152,0.36112520000000004,-0.034649600000000016],[-0.0120663,0.8756742000000001,0.03253299999999998]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left gracilis',
    'Lower Body',
    'BodyParts3D Concept: left gracilis (FMA43884)',
    'FMA43884',
    'FMA43884',
    '["FJ1421M"]'::jsonb,
    '[[0.0120663,0.36112520000000004,-0.034649600000000016],[0.0704152,0.8756742000000001,0.03253299999999998]]'::jsonb,
    'muscular',
    'left gracilis',
    '{"conceptId":"FMA43884","elements":["FJ1421M"],"system":"muscular","bounds":[[0.0120663,0.36112520000000004,-0.034649600000000016],[0.0704152,0.8756742000000001,0.03253299999999998]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right iliacus',
    'Core',
    'BodyParts3D Concept: right iliacus (FMA22322)',
    'FMA22322',
    'FMA22322',
    '["FJ1422"]'::jsonb,
    '[[-0.127254,0.8119332,-0.0536466],[-0.0727491,1.0361022,0.029449000000000003]]'::jsonb,
    'muscular',
    'right iliacus',
    '{"conceptId":"FMA22322","elements":["FJ1422"],"system":"muscular","bounds":[[-0.127254,0.8119332,-0.0536466],[-0.0727491,1.0361022,0.029449000000000003]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left iliacus',
    'Core',
    'BodyParts3D Concept: left iliacus (FMA22323)',
    'FMA22323',
    'FMA22323',
    '["FJ1422M"]'::jsonb,
    '[[0.0727491,0.8119332,-0.0536466],[0.127254,1.0361022,0.029449000000000003]]'::jsonb,
    'muscular',
    'left iliacus',
    '{"conceptId":"FMA22323","elements":["FJ1422M"],"system":"muscular","bounds":[[0.0727491,0.8119332,-0.0536466],[0.127254,1.0361022,0.029449000000000003]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right obturator externus',
    'Muscular System',
    'BodyParts3D Concept: right obturator externus (FMA22326)',
    'FMA22326',
    'FMA22326',
    '["FJ1425"]'::jsonb,
    '[[-0.128389,0.8454912000000001,-0.044532800000000004],[-0.0244292,0.8747252000000001,0.009507000000000002]]'::jsonb,
    'muscular',
    'right obturator externus',
    '{"conceptId":"FMA22326","elements":["FJ1425"],"system":"muscular","bounds":[[-0.128389,0.8454912000000001,-0.044532800000000004],[-0.0244292,0.8747252000000001,0.009507000000000002]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left obturator externus',
    'Muscular System',
    'BodyParts3D Concept: left obturator externus (FMA22327)',
    'FMA22327',
    'FMA22327',
    '["FJ1425M"]'::jsonb,
    '[[0.0244292,0.8454912000000001,-0.044532800000000004],[0.128389,0.8747252000000001,0.009507000000000002]]'::jsonb,
    'muscular',
    'left obturator externus',
    '{"conceptId":"FMA22327","elements":["FJ1425M"],"system":"muscular","bounds":[[0.0244292,0.8454912000000001,-0.044532800000000004],[0.128389,0.8747252000000001,0.009507000000000002]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right obturator internus',
    'Muscular System',
    'BodyParts3D Concept: right obturator internus (FMA22324)',
    'FMA22324',
    'FMA22324',
    '["FJ1426"]'::jsonb,
    '[[-0.119051,0.8484842000000001,-0.07065690000000001],[-0.021533300000000002,0.9056052000000001,0.007096000000000005]]'::jsonb,
    'muscular',
    'right obturator internus',
    '{"conceptId":"FMA22324","elements":["FJ1426"],"system":"muscular","bounds":[[-0.119051,0.8484842000000001,-0.07065690000000001],[-0.021533300000000002,0.9056052000000001,0.007096000000000005]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left obturator internus',
    'Muscular System',
    'BodyParts3D Concept: left obturator internus (FMA22325)',
    'FMA22325',
    'FMA22325',
    '["FJ1426M"]'::jsonb,
    '[[0.021533300000000002,0.8484842000000001,-0.07065690000000001],[0.119051,0.9056052000000001,0.007096000000000005]]'::jsonb,
    'muscular',
    'left obturator internus',
    '{"conceptId":"FMA22325","elements":["FJ1426M"],"system":"muscular","bounds":[[0.021533300000000002,0.8484842000000001,-0.07065690000000001],[0.119051,0.9056052000000001,0.007096000000000005]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right pectineus',
    'Lower Body',
    'BodyParts3D Concept: right pectineus (FMA22450)',
    'FMA22450',
    'FMA22450',
    '["FJ1427"]'::jsonb,
    '[[-0.0985326,0.7532222000000001,-0.020781999999999995],[-0.0227376,0.8939652000000001,0.036002000000000006]]'::jsonb,
    'muscular',
    'right pectineus',
    '{"conceptId":"FMA22450","elements":["FJ1427"],"system":"muscular","bounds":[[-0.0985326,0.7532222000000001,-0.020781999999999995],[-0.0227376,0.8939652000000001,0.036002000000000006]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left pectineus',
    'Lower Body',
    'BodyParts3D Concept: left pectineus (FMA22451)',
    'FMA22451',
    'FMA22451',
    '["FJ1427M"]'::jsonb,
    '[[0.0227376,0.7532222000000001,-0.020781999999999995],[0.0985326,0.8939652000000001,0.036002000000000006]]'::jsonb,
    'muscular',
    'left pectineus',
    '{"conceptId":"FMA22451","elements":["FJ1427M"],"system":"muscular","bounds":[[0.0227376,0.7532222000000001,-0.020781999999999995],[0.0985326,0.8939652000000001,0.036002000000000006]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right piriformis',
    'Muscular System',
    'BodyParts3D Concept: right piriformis (FMA22340)',
    'FMA22340',
    'FMA22340',
    '["FJ1428"]'::jsonb,
    '[[-0.13706000000000002,0.8841672000000002,-0.0879178],[-0.0254805,0.9505142000000001,-0.027981400000000003]]'::jsonb,
    'muscular',
    'right piriformis',
    '{"conceptId":"FMA22340","elements":["FJ1428"],"system":"muscular","bounds":[[-0.13706000000000002,0.8841672000000002,-0.0879178],[-0.0254805,0.9505142000000001,-0.027981400000000003]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left piriformis',
    'Muscular System',
    'BodyParts3D Concept: left piriformis (FMA22341)',
    'FMA22341',
    'FMA22341',
    '["FJ1428M"]'::jsonb,
    '[[0.0254805,0.8841672000000002,-0.0879178],[0.13706000000000002,0.9505142000000001,-0.027981400000000003]]'::jsonb,
    'muscular',
    'left piriformis',
    '{"conceptId":"FMA22341","elements":["FJ1428M"],"system":"muscular","bounds":[[0.0254805,0.8841672000000002,-0.0879178],[0.13706000000000002,0.9505142000000001,-0.027981400000000003]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right plantaris',
    'Lower Body',
    'BodyParts3D Concept: right plantaris (FMA22560)',
    'FMA22560',
    'FMA22560',
    '["FJ1429"]'::jsonb,
    '[[-0.100568,0.024871400000000002,-0.0644181],[-0.0390826,0.5340072,-0.0011221000000000009]]'::jsonb,
    'muscular',
    'right plantaris',
    '{"conceptId":"FMA22560","elements":["FJ1429"],"system":"muscular","bounds":[[-0.100568,0.024871400000000002,-0.0644181],[-0.0390826,0.5340072,-0.0011221000000000009]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left plantaris',
    'Lower Body',
    'BodyParts3D Concept: left plantaris (FMA22561)',
    'FMA22561',
    'FMA22561',
    '["FJ1429M"]'::jsonb,
    '[[0.0390826,0.024871400000000002,-0.064418],[0.100568,0.5340072,-0.0011221000000000009]]'::jsonb,
    'muscular',
    'left plantaris',
    '{"conceptId":"FMA22561","elements":["FJ1429M"],"system":"muscular","bounds":[[0.0390826,0.024871400000000002,-0.064418],[0.100568,0.5340072,-0.0011221000000000009]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right popliteus',
    'Lower Body',
    'BodyParts3D Concept: right popliteus (FMA22591)',
    'FMA22591',
    'FMA22591',
    '["FJ1430"]'::jsonb,
    '[[-0.109488,0.34003320000000004,-0.0524193],[-0.0566275,0.4847222,-0.006738800000000003]]'::jsonb,
    'muscular',
    'right popliteus',
    '{"conceptId":"FMA22591","elements":["FJ1430"],"system":"muscular","bounds":[[-0.109488,0.34003320000000004,-0.0524193],[-0.0566275,0.4847222,-0.006738800000000003]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left popliteus',
    'Lower Body',
    'BodyParts3D Concept: left popliteus (FMA22592)',
    'FMA22592',
    'FMA22592',
    '["FJ1430M"]'::jsonb,
    '[[0.0566275,0.34003320000000004,-0.0524193],[0.109488,0.4847222,-0.006738800000000003]]'::jsonb,
    'muscular',
    'left popliteus',
    '{"conceptId":"FMA22592","elements":["FJ1430M"],"system":"muscular","bounds":[[0.0566275,0.34003320000000004,-0.0524193],[0.109488,0.4847222,-0.006738800000000003]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right psoas major',
    'Core',
    'BodyParts3D Concept: right psoas major (FMA22342)',
    'FMA22342',
    'FMA22342',
    '["FJ1431"]'::jsonb,
    '[[-0.113758,0.8133262000000001,-0.0468651],[-0.00747519,1.1768512,0.019566]]'::jsonb,
    'muscular',
    'right psoas major',
    '{"conceptId":"FMA22342","elements":["FJ1431"],"system":"muscular","bounds":[[-0.113758,0.8133262000000001,-0.0468651],[-0.00747519,1.1768512,0.019566]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left psoas major',
    'Core',
    'BodyParts3D Concept: left psoas major (FMA22343)',
    'FMA22343',
    'FMA22343',
    '["FJ1431M"]'::jsonb,
    '[[0.00747519,0.8133262000000001,-0.0468651],[0.11375700000000001,1.1768512,0.019566]]'::jsonb,
    'muscular',
    'left psoas major',
    '{"conceptId":"FMA22343","elements":["FJ1431M"],"system":"muscular","bounds":[[0.00747519,0.8133262000000001,-0.0468651],[0.11375700000000001,1.1768512,0.019566]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right quadratus femoris',
    'Lower Body',
    'BodyParts3D Concept: right quadratus femoris (FMA22338)',
    'FMA22338',
    'FMA22338',
    '["FJ1432"]'::jsonb,
    '[[-0.127187,0.8217652000000001,-0.0573439],[-0.0565706,0.8679652000000001,-0.0421136]]'::jsonb,
    'muscular',
    'right quadratus femoris',
    '{"conceptId":"FMA22338","elements":["FJ1432"],"system":"muscular","bounds":[[-0.127187,0.8217652000000001,-0.0573439],[-0.0565706,0.8679652000000001,-0.0421136]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left quadratus femoris',
    'Lower Body',
    'BodyParts3D Concept: left quadratus femoris (FMA22339)',
    'FMA22339',
    'FMA22339',
    '["FJ1432M"]'::jsonb,
    '[[0.0565706,0.8217652000000001,-0.0573439],[0.127187,0.8679652000000001,-0.0421136]]'::jsonb,
    'muscular',
    'left quadratus femoris',
    '{"conceptId":"FMA22339","elements":["FJ1432M"],"system":"muscular","bounds":[[0.0565706,0.8217652000000001,-0.0573439],[0.127187,0.8679652000000001,-0.0421136]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right rectus femoris',
    'Lower Body',
    'BodyParts3D Concept: right rectus femoris (FMA38928)',
    'FMA38928',
    'FMA38928',
    '["FJ1433"]'::jsonb,
    '[[-0.154449,0.39281920000000004,-0.01610020000000001],[-0.0629145,0.9492152000000001,0.05246600000000001]]'::jsonb,
    'muscular',
    'right rectus femoris',
    '{"conceptId":"FMA38928","elements":["FJ1433"],"system":"muscular","bounds":[[-0.154449,0.39281920000000004,-0.01610020000000001],[-0.0629145,0.9492152000000001,0.05246600000000001]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left rectus femoris',
    'Lower Body',
    'BodyParts3D Concept: left rectus femoris (FMA38929)',
    'FMA38929',
    'FMA38929',
    '["FJ1433M"]'::jsonb,
    '[[0.0629145,0.39281920000000004,-0.01610020000000001],[0.154449,0.9492152000000001,0.05246600000000001]]'::jsonb,
    'muscular',
    'left rectus femoris',
    '{"conceptId":"FMA38929","elements":["FJ1433M"],"system":"muscular","bounds":[[0.0629145,0.39281920000000004,-0.01610020000000001],[0.154449,0.9492152000000001,0.05246600000000001]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right sartorius',
    'Lower Body',
    'BodyParts3D Concept: right sartorius (FMA22354)',
    'FMA22354',
    'FMA22354',
    '["FJ1434"]'::jsonb,
    '[[-0.131186,0.3523012,-0.016009300000000004],[-0.0206605,0.9799032000000001,0.04095599999999999]]'::jsonb,
    'muscular',
    'right sartorius',
    '{"conceptId":"FMA22354","elements":["FJ1434"],"system":"muscular","bounds":[[-0.131186,0.3523012,-0.016009300000000004],[-0.0206605,0.9799032000000001,0.04095599999999999]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left sartorius',
    'Lower Body',
    'BodyParts3D Concept: left sartorius (FMA22355)',
    'FMA22355',
    'FMA22355',
    '["FJ1434M"]'::jsonb,
    '[[0.0206605,0.3523012,-0.016009300000000004],[0.131186,0.9799032000000001,0.04095599999999999]]'::jsonb,
    'muscular',
    'left sartorius',
    '{"conceptId":"FMA22355","elements":["FJ1434M"],"system":"muscular","bounds":[[0.0206605,0.3523012,-0.016009300000000004],[0.131186,0.9799032000000001,0.04095599999999999]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right semimembranosus',
    'Lower Body',
    'BodyParts3D Concept: right semimembranosus (FMA22448)',
    'FMA22448',
    'FMA22448',
    '["FJ1435"]'::jsonb,
    '[[-0.0709992,0.3940372,-0.06267030000000001],[-0.0131749,0.8325492000000001,0.003494999999999998]]'::jsonb,
    'muscular',
    'right semimembranosus',
    '{"conceptId":"FMA22448","elements":["FJ1435"],"system":"muscular","bounds":[[-0.0709992,0.3940372,-0.06267030000000001],[-0.0131749,0.8325492000000001,0.003494999999999998]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left semimembranosus',
    'Lower Body',
    'BodyParts3D Concept: left semimembranosus (FMA22449)',
    'FMA22449',
    'FMA22449',
    '["FJ1435M"]'::jsonb,
    '[[0.0131749,0.3940372,-0.06267040000000001],[0.0709991,0.8325492000000001,0.003494999999999998]]'::jsonb,
    'muscular',
    'left semimembranosus',
    '{"conceptId":"FMA22449","elements":["FJ1435M"],"system":"muscular","bounds":[[0.0131749,0.3940372,-0.06267040000000001],[0.0709991,0.8325492000000001,0.003494999999999998]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right semitendinosus',
    'Lower Body',
    'BodyParts3D Concept: right semitendinosus (FMA22358)',
    'FMA22358',
    'FMA22358',
    '["FJ1436"]'::jsonb,
    '[[-0.0682937,0.3612362,-0.0752197],[-0.0269358,0.8418142000000001,-0.001413499999999998]]'::jsonb,
    'muscular',
    'right semitendinosus',
    '{"conceptId":"FMA22358","elements":["FJ1436"],"system":"muscular","bounds":[[-0.0682937,0.3612362,-0.0752197],[-0.0269358,0.8418142000000001,-0.001413499999999998]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left semitendinosus',
    'Lower Body',
    'BodyParts3D Concept: left semitendinosus (FMA22359)',
    'FMA22359',
    'FMA22359',
    '["FJ1436M"]'::jsonb,
    '[[0.0269357,0.3612362,-0.0752197],[0.0682937,0.8418142000000001,-0.001413499999999998]]'::jsonb,
    'muscular',
    'left semitendinosus',
    '{"conceptId":"FMA22359","elements":["FJ1436M"],"system":"muscular","bounds":[[0.0269357,0.3612362,-0.0752197],[0.0682937,0.8418142000000001,-0.001413499999999998]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right soleus',
    'Lower Body',
    'BodyParts3D Concept: right soleus (FMA22558)',
    'FMA22558',
    'FMA22558',
    '["FJ1437"]'::jsonb,
    '[[-0.115785,0.11057520000000001,-0.06780140000000001],[-0.035600099999999996,0.4367282,-0.008881100000000003]]'::jsonb,
    'muscular',
    'right soleus',
    '{"conceptId":"FMA22558","elements":["FJ1437"],"system":"muscular","bounds":[[-0.115785,0.11057520000000001,-0.06780140000000001],[-0.035600099999999996,0.4367282,-0.008881100000000003]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left soleus',
    'Lower Body',
    'BodyParts3D Concept: left soleus (FMA22559)',
    'FMA22559',
    'FMA22559',
    '["FJ1437M"]'::jsonb,
    '[[0.035600099999999996,0.11057520000000001,-0.06780140000000001],[0.115785,0.4367282,-0.008881100000000003]]'::jsonb,
    'muscular',
    'left soleus',
    '{"conceptId":"FMA22559","elements":["FJ1437M"],"system":"muscular","bounds":[[0.035600099999999996,0.11057520000000001,-0.06780140000000001],[0.115785,0.4367282,-0.008881100000000003]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right vastus intermedius',
    'Lower Body',
    'BodyParts3D Concept: right vastus intermedius (FMA38934)',
    'FMA38934',
    'FMA38934',
    '["FJ1441"]'::jsonb,
    '[[-0.133095,0.42059620000000003,-0.023739200000000002],[-0.0762071,0.8478552000000001,0.035139000000000004]]'::jsonb,
    'muscular',
    'right vastus intermedius',
    '{"conceptId":"FMA38934","elements":["FJ1441"],"system":"muscular","bounds":[[-0.133095,0.42059620000000003,-0.023739200000000002],[-0.0762071,0.8478552000000001,0.035139000000000004]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left vastus intermedius',
    'Lower Body',
    'BodyParts3D Concept: left vastus intermedius (FMA38935)',
    'FMA38935',
    'FMA38935',
    '["FJ1441M"]'::jsonb,
    '[[0.0762071,0.42059620000000003,-0.023739200000000002],[0.13309600000000002,0.8478552000000001,0.035139000000000004]]'::jsonb,
    'muscular',
    'left vastus intermedius',
    '{"conceptId":"FMA38935","elements":["FJ1441M"],"system":"muscular","bounds":[[0.0762071,0.42059620000000003,-0.023739200000000002],[0.13309600000000002,0.8478552000000001,0.035139000000000004]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right vastus lateralis',
    'Lower Body',
    'BodyParts3D Concept: right vastus lateralis (FMA38930)',
    'FMA38930',
    'FMA38930',
    '["FJ1442"]'::jsonb,
    '[[-0.159632,0.39604320000000004,-0.0424968],[-0.0840565,0.8662782000000001,0.03705099999999997]]'::jsonb,
    'muscular',
    'right vastus lateralis',
    '{"conceptId":"FMA38930","elements":["FJ1442"],"system":"muscular","bounds":[[-0.159632,0.39604320000000004,-0.0424968],[-0.0840565,0.8662782000000001,0.03705099999999997]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left vastus lateralis',
    'Lower Body',
    'BodyParts3D Concept: left vastus lateralis (FMA38931)',
    'FMA38931',
    'FMA38931',
    '["FJ1442M"]'::jsonb,
    '[[0.0840565,0.39604320000000004,-0.0424968],[0.15963300000000002,0.8662782000000001,0.03705099999999997]]'::jsonb,
    'muscular',
    'left vastus lateralis',
    '{"conceptId":"FMA38931","elements":["FJ1442M"],"system":"muscular","bounds":[[0.0840565,0.39604320000000004,-0.0424968],[0.15963300000000002,0.8662782000000001,0.03705099999999997]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right vastus medialis',
    'Lower Body',
    'BodyParts3D Concept: right vastus medialis (FMA38932)',
    'FMA38932',
    'FMA38932',
    '["FJ1443"]'::jsonb,
    '[[-0.105601,0.4186592,-0.010868000000000003],[-0.034939200000000004,0.8162902000000001,0.046901]]'::jsonb,
    'muscular',
    'right vastus medialis',
    '{"conceptId":"FMA38932","elements":["FJ1443"],"system":"muscular","bounds":[[-0.105601,0.4186592,-0.010868000000000003],[-0.034939200000000004,0.8162902000000001,0.046901]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left vastus medialis',
    'Lower Body',
    'BodyParts3D Concept: left vastus medialis (FMA38933)',
    'FMA38933',
    'FMA38933',
    '["FJ1443M"]'::jsonb,
    '[[0.034939300000000006,0.4186592,-0.010868000000000003],[0.105601,0.8162902000000001,0.046901]]'::jsonb,
    'muscular',
    'left vastus medialis',
    '{"conceptId":"FMA38933","elements":["FJ1443M"],"system":"muscular","bounds":[[0.034939300000000006,0.4186592,-0.010868000000000003],[0.105601,0.8162902000000001,0.046901]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Short head of right biceps femoris',
    'Lower Body',
    'BodyParts3D Concept: short head of right biceps femoris (FMA45891)',
    'FMA45891',
    'FMA45891',
    '["FJ1444"]'::jsonb,
    '[[-0.11740900000000001,0.4063012,-0.04911820000000001],[-0.0806712,0.7247312,-0.012521299999999999]]'::jsonb,
    'muscular',
    'short head of right biceps femoris',
    '{"conceptId":"FMA45891","elements":["FJ1444"],"system":"muscular","bounds":[[-0.11740900000000001,0.4063012,-0.04911820000000001],[-0.0806712,0.7247312,-0.012521299999999999]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Short head of left biceps femoris',
    'Lower Body',
    'BodyParts3D Concept: short head of left biceps femoris (FMA45892)',
    'FMA45892',
    'FMA45892',
    '["FJ1444M"]'::jsonb,
    '[[0.0806712,0.4063012,-0.04911820000000001],[0.11740900000000001,0.7247312,-0.012521299999999999]]'::jsonb,
    'muscular',
    'short head of left biceps femoris',
    '{"conceptId":"FMA45892","elements":["FJ1444M"],"system":"muscular","bounds":[[0.0806712,0.4063012,-0.04911820000000001],[0.11740900000000001,0.7247312,-0.012521299999999999]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Transverse head of right adductor hallucis',
    'Lower Body',
    'BodyParts3D Concept: transverse head of right adductor hallucis (FMA46020)',
    'FMA46020',
    'FMA46020',
    '["FJ1445"]'::jsonb,
    '[[-0.140133,0.012534400000000001,0.047929],[-0.0983091,0.0197496,0.078952]]'::jsonb,
    'muscular',
    'transverse head of right adductor hallucis',
    '{"conceptId":"FMA46020","elements":["FJ1445"],"system":"muscular","bounds":[[-0.140133,0.012534400000000001,0.047929],[-0.0983091,0.0197496,0.078952]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Transverse head of left adductor hallucis',
    'Lower Body',
    'BodyParts3D Concept: transverse head of left adductor hallucis (FMA46021)',
    'FMA46021',
    'FMA46021',
    '["FJ1445M"]'::jsonb,
    '[[0.0983091,0.012534400000000001,0.047929],[0.140133,0.0197496,0.078952]]'::jsonb,
    'muscular',
    'transverse head of left adductor hallucis',
    '{"conceptId":"FMA46021","elements":["FJ1445M"],"system":"muscular","bounds":[[0.0983091,0.012534400000000001,0.047929],[0.140133,0.0197496,0.078952]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Abdominal part of right pectoralis major',
    'Upper Body',
    'BodyParts3D Concept: abdominal part of right pectoralis major (FMA45874)',
    'FMA45874',
    'FMA45874',
    '["FJ1446"]'::jsonb,
    '[[-0.180896,1.1828912,-0.0182436],[-0.048,1.3560512,0.11362799999999998]]'::jsonb,
    'muscular',
    'abdominal part of right pectoralis major',
    '{"conceptId":"FMA45874","elements":["FJ1446"],"system":"muscular","bounds":[[-0.180896,1.1828912,-0.0182436],[-0.048,1.3560512,0.11362799999999998]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Abdominal part of left pectoralis major',
    'Upper Body',
    'BodyParts3D Concept: abdominal part of left pectoralis major (FMA45875)',
    'FMA45875',
    'FMA45875',
    '["FJ1446M"]'::jsonb,
    '[[0.048,1.1828912,-0.0182436],[0.180896,1.3560512,0.11362799999999998]]'::jsonb,
    'muscular',
    'abdominal part of left pectoralis major',
    '{"conceptId":"FMA45875","elements":["FJ1446M"],"system":"muscular","bounds":[[0.048,1.1828912,-0.0182436],[0.180896,1.3560512,0.11362799999999998]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Clavicular part of right pectoralis major',
    'Upper Body',
    'BodyParts3D Concept: clavicular part of right pectoralis major (FMA34690)',
    'FMA34690',
    'FMA34690',
    '["FJ1447"]'::jsonb,
    '[[-0.19426200000000002,1.3126212,-0.018000000000000002],[-0.0264139,1.4140112,0.045096]]'::jsonb,
    'muscular',
    'clavicular part of right pectoralis major',
    '{"conceptId":"FMA34690","elements":["FJ1447"],"system":"muscular","bounds":[[-0.19426200000000002,1.3126212,-0.018000000000000002],[-0.0264139,1.4140112,0.045096]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Clavicular part of left pectoralis major',
    'Upper Body',
    'BodyParts3D Concept: clavicular part of left pectoralis major (FMA34691)',
    'FMA34691',
    'FMA34691',
    '["FJ1447M"]'::jsonb,
    '[[0.0264139,1.3126212,-0.018000000000000002],[0.19426200000000002,1.4140112,0.045096]]'::jsonb,
    'muscular',
    'clavicular part of left pectoralis major',
    '{"conceptId":"FMA34691","elements":["FJ1447M"],"system":"muscular","bounds":[[0.0264139,1.3126212,-0.018000000000000002],[0.19426200000000002,1.4140112,0.045096]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left coccygeus',
    'Muscular System',
    'BodyParts3D Concept: left coccygeus (FMA46444)',
    'FMA46444',
    'FMA46444',
    '["FJ1449M","FJ2542"]'::jsonb,
    '[[0.00247649,0.8661892,-0.09120005],[0.0487138,0.9067352000000001,-0.0619615]]'::jsonb,
    'muscular',
    'left coccygeus',
    '{"conceptId":"FMA46444","elements":["FJ1449M","FJ2542"],"system":"muscular","bounds":[[0.00247649,0.8661892,-0.09120005],[0.0487138,0.9067352000000001,-0.0619615]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Superficial perineal muscle',
    'Muscular System',
    'BodyParts3D Concept: superficial perineal muscle (FMA19728)',
    'FMA19728',
    'FMA19728',
    '["FJ1450","FJ1450M","FJ2543","FJ2548"]'::jsonb,
    '[[-0.014787400000000001,0.8317212,-0.08305610000000001],[-0.00328195,0.8529722000000001,-0.0612757]]'::jsonb,
    'muscular',
    'superficial perineal muscle',
    '{"conceptId":"FMA19728","elements":["FJ1450","FJ1450M","FJ2543","FJ2548"],"system":"muscular","bounds":[[-0.014787400000000001,0.8317212,-0.08305610000000001],[-0.00328195,0.8529722000000001,-0.0612757]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'External anal sphincter',
    'Muscular System',
    'BodyParts3D Concept: external anal sphincter (FMA21930)',
    'FMA21930',
    'FMA21930',
    '["FJ1450","FJ1450M","FJ2543","FJ2548"]'::jsonb,
    '[[0.00328195,0.8317212,-0.08305610000000001],[0.014787400000000001,0.8529722000000001,-0.0612756]]'::jsonb,
    'muscular',
    'external anal sphincter',
    '{"conceptId":"FMA21930","elements":["FJ1450","FJ1450M","FJ2543","FJ2548"],"system":"muscular","bounds":[[0.00328195,0.8317212,-0.08305610000000001],[0.014787400000000001,0.8529722000000001,-0.0612756]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'External intercostal muscle',
    'Core',
    'BodyParts3D Concept: external intercostal muscle (FMA9756)',
    'FMA9756',
    'FMA9756',
    '["FJ1451","FJ1451M"]'::jsonb,
    '[[-0.136166,1.0896211999999998,-0.09671826],[-0.0232953,1.4434411999999999,0.091641]]'::jsonb,
    'muscular',
    'external intercostal muscle',
    '{"conceptId":"FMA9756","elements":["FJ1451","FJ1451M"],"system":"muscular","bounds":[[-0.136166,1.0896211999999998,-0.09671826],[-0.0232953,1.4434411999999999,0.091641]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right external oblique',
    'Core',
    'BodyParts3D Concept: right external oblique (FMA13336)',
    'FMA13336',
    'FMA13336',
    '["FJ1452"]'::jsonb,
    '[[-0.140823,0.8717372,-0.06297920000000001],[-0.00344858,1.2896911999999998,0.11876599999999998]]'::jsonb,
    'muscular',
    'right external oblique',
    '{"conceptId":"FMA13336","elements":["FJ1452"],"system":"muscular","bounds":[[-0.140823,0.8717372,-0.06297920000000001],[-0.00344858,1.2896911999999998,0.11876599999999998]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left external oblique',
    'Core',
    'BodyParts3D Concept: left external oblique (FMA13337)',
    'FMA13337',
    'FMA13337',
    '["FJ1452M"]'::jsonb,
    '[[0.00344857,0.8717362000000001,-0.06297920000000001],[0.140823,1.2896911999999998,0.11876599999999998]]'::jsonb,
    'muscular',
    'left external oblique',
    '{"conceptId":"FMA13337","elements":["FJ1452M"],"system":"muscular","bounds":[[0.00344857,0.8717362000000001,-0.06297920000000001],[0.140823,1.2896911999999998,0.11876599999999998]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left iliococcygeus',
    'Muscular System',
    'BodyParts3D Concept: left iliococcygeus (FMA45859)',
    'FMA45859',
    'FMA45859',
    '["FJ1453M","FJ2544"]'::jsonb,
    '[[0.000657022,0.8541472,-0.0849338],[0.0491884,0.8998332,-0.011599100000000015]]'::jsonb,
    'muscular',
    'left iliococcygeus',
    '{"conceptId":"FMA45859","elements":["FJ1453M","FJ2544"],"system":"muscular","bounds":[[0.000657022,0.8541472,-0.0849338],[0.0491884,0.8998332,-0.011599100000000015]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Innermost intercostal muscle',
    'Core',
    'BodyParts3D Concept: innermost intercostal muscle (FMA9758)',
    'FMA9758',
    'FMA9758',
    '["FJ1454","FJ1454M"]'::jsonb,
    '[[-0.134625,1.0972712,-0.09369722000000001],[-0.0507763,1.3931012,0.09337299999999998]]'::jsonb,
    'muscular',
    'innermost intercostal muscle',
    '{"conceptId":"FMA9758","elements":["FJ1454","FJ1454M"],"system":"muscular","bounds":[[-0.134625,1.0972712,-0.09369722000000001],[-0.0507763,1.3931012,0.09337299999999998]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Internal intercostal muscle',
    'Core',
    'BodyParts3D Concept: internal intercostal muscle (FMA9757)',
    'FMA9757',
    'FMA9757',
    '["FJ1455","FJ1455M"]'::jsonb,
    '[[-0.13291399999999998,1.0965512,-0.09534531],[-0.0162457,1.3921312,0.10931100000000002]]'::jsonb,
    'muscular',
    'internal intercostal muscle',
    '{"conceptId":"FMA9757","elements":["FJ1455","FJ1455M"],"system":"muscular","bounds":[[-0.13291399999999998,1.0965512,-0.09534531],[-0.0162457,1.3921312,0.10931100000000002]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right pectoralis minor',
    'Upper Body',
    'BodyParts3D Concept: right pectoralis minor (FMA13375)',
    'FMA13375',
    'FMA13375',
    '["FJ1456"]'::jsonb,
    '[[-0.130176,1.2597712,-0.01965080000000001],[-0.0697359,1.4047812,0.073047]]'::jsonb,
    'muscular',
    'right pectoralis minor',
    '{"conceptId":"FMA13375","elements":["FJ1456"],"system":"muscular","bounds":[[-0.130176,1.2597712,-0.01965080000000001],[-0.0697359,1.4047812,0.073047]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left pectoralis minor',
    'Upper Body',
    'BodyParts3D Concept: left pectoralis minor (FMA13376)',
    'FMA13376',
    'FMA13376',
    '["FJ1456M"]'::jsonb,
    '[[0.0697359,1.2597712,-0.01965080000000001],[0.130176,1.4047812,0.073047]]'::jsonb,
    'muscular',
    'left pectoralis minor',
    '{"conceptId":"FMA13376","elements":["FJ1456M"],"system":"muscular","bounds":[[0.0697359,1.2597712,-0.01965080000000001],[0.130176,1.4047812,0.073047]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left pubococcygeus',
    'Muscular System',
    'BodyParts3D Concept: left pubococcygeus (FMA45855)',
    'FMA45855',
    'FMA45855',
    '["FJ1457M","FJ2545"]'::jsonb,
    '[[0.00316466,0.8453422,-0.089518],[0.0354065,0.8927342000000001,0.0005300000000000027]]'::jsonb,
    'muscular',
    'left pubococcygeus',
    '{"conceptId":"FMA45855","elements":["FJ1457M","FJ2545"],"system":"muscular","bounds":[[0.00316466,0.8453422,-0.089518],[0.0354065,0.8927342000000001,0.0005300000000000027]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left puborectalis',
    'Muscular System',
    'BodyParts3D Concept: left puborectalis (FMA45857)',
    'FMA45857',
    'FMA45857',
    '["FJ1458M","FJ2546"]'::jsonb,
    '[[0.00321461,0.8412132,-0.0786943],[0.032625799999999996,0.8699272000000001,0.002803]]'::jsonb,
    'muscular',
    'left puborectalis',
    '{"conceptId":"FMA45857","elements":["FJ1458M","FJ2546"],"system":"muscular","bounds":[[0.00321461,0.8412132,-0.0786943],[0.032625799999999996,0.8699272000000001,0.002803]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right serratus anterior',
    'Upper Body',
    'BodyParts3D Concept: right serratus anterior (FMA13398)',
    'FMA13398',
    'FMA13398',
    '["FJ1459"]'::jsonb,
    '[[-0.144392,1.1562712,-0.10526406],[-0.0577297,1.4264912,0.057592000000000004]]'::jsonb,
    'muscular',
    'right serratus anterior',
    '{"conceptId":"FMA13398","elements":["FJ1459"],"system":"muscular","bounds":[[-0.144392,1.1562712,-0.10526406],[-0.0577297,1.4264912,0.057592000000000004]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left serratus anterior',
    'Upper Body',
    'BodyParts3D Concept: left serratus anterior (FMA13399)',
    'FMA13399',
    'FMA13399',
    '["FJ1459M"]'::jsonb,
    '[[0.0577298,1.1562712,-0.10526406],[0.144392,1.4264912,0.057592000000000004]]'::jsonb,
    'muscular',
    'left serratus anterior',
    '{"conceptId":"FMA13399","elements":["FJ1459M"],"system":"muscular","bounds":[[0.0577298,1.1562712,-0.10526406],[0.144392,1.4264912,0.057592000000000004]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right subclavius',
    'Muscular System',
    'BodyParts3D Concept: right subclavius (FMA13412)',
    'FMA13412',
    'FMA13412',
    '["FJ1460"]'::jsonb,
    '[[-0.104677,1.3895712,-0.0259007],[-0.034288,1.4209711999999999,0.03487399999999999]]'::jsonb,
    'muscular',
    'right subclavius',
    '{"conceptId":"FMA13412","elements":["FJ1460"],"system":"muscular","bounds":[[-0.104677,1.3895712,-0.0259007],[-0.034288,1.4209711999999999,0.03487399999999999]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left subclavius',
    'Muscular System',
    'BodyParts3D Concept: left subclavius (FMA13411)',
    'FMA13411',
    'FMA13411',
    '["FJ1460M"]'::jsonb,
    '[[0.034288,1.3895112,-0.0259007],[0.104677,1.4209711999999999,0.03487399999999999]]'::jsonb,
    'muscular',
    'left subclavius',
    '{"conceptId":"FMA13411","elements":["FJ1460M"],"system":"muscular","bounds":[[0.034288,1.3895112,-0.0259007],[0.104677,1.4209711999999999,0.03487399999999999]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right transversus thoracis',
    'Core',
    'BodyParts3D Concept: right transversus thoracis (FMA9761)',
    'FMA9761',
    'FMA9761',
    '["FJ1461"]'::jsonb,
    '[[-0.0895742,1.2215612,0.055483000000000005],[-0.00233101,1.3665212,0.10952099999999998]]'::jsonb,
    'muscular',
    'right transversus thoracis',
    '{"conceptId":"FMA9761","elements":["FJ1461"],"system":"muscular","bounds":[[-0.0895742,1.2215612,0.055483000000000005],[-0.00233101,1.3665212,0.10952099999999998]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left transversus thoracis',
    'Core',
    'BodyParts3D Concept: left transversus thoracis (FMA9762)',
    'FMA9762',
    'FMA9762',
    '["FJ1461M"]'::jsonb,
    '[[0.00233101,1.2215612,0.055483000000000005],[0.0895742,1.3665212,0.10952099999999998]]'::jsonb,
    'muscular',
    'left transversus thoracis',
    '{"conceptId":"FMA9762","elements":["FJ1461M"],"system":"muscular","bounds":[[0.00233101,1.2215612,0.055483000000000005],[0.0895742,1.3665212,0.10952099999999998]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Set of right levatores costarum breves',
    'Muscular System',
    'BodyParts3D Concept: set of right levatores costarum breves (FMA74077)',
    'FMA74077',
    'FMA74077',
    '["FJ1462"]'::jsonb,
    '[[-0.0708734,1.1413012,-0.09327797],[-0.0208167,1.4579012,-0.027375100000000013]]'::jsonb,
    'muscular',
    'set of right levatores costarum breves',
    '{"conceptId":"FMA74077","elements":["FJ1462"],"system":"muscular","bounds":[[-0.0708734,1.1413012,-0.09327797],[-0.0208167,1.4579012,-0.027375100000000013]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Set of left levatores costarum breves',
    'Muscular System',
    'BodyParts3D Concept: set of left levatores costarum breves (FMA74078)',
    'FMA74078',
    'FMA74078',
    '["FJ1462M"]'::jsonb,
    '[[0.0208167,1.1413012,-0.09327798000000001],[0.0708734,1.4579012,-0.027375100000000013]]'::jsonb,
    'muscular',
    'set of left levatores costarum breves',
    '{"conceptId":"FMA74078","elements":["FJ1462M"],"system":"muscular","bounds":[[0.0208167,1.1413012,-0.09327798000000001],[0.0708734,1.4579012,-0.027375100000000013]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Set of right levatores costarum longi',
    'Muscular System',
    'BodyParts3D Concept: set of right levatores costarum longi (FMA74075)',
    'FMA74075',
    'FMA74075',
    '["FJ1463"]'::jsonb,
    '[[-0.0745211,1.1393212,-0.09570499],[-0.0286357,1.4584112,-0.027503]]'::jsonb,
    'muscular',
    'set of right levatores costarum longi',
    '{"conceptId":"FMA74075","elements":["FJ1463"],"system":"muscular","bounds":[[-0.0745211,1.1393212,-0.09570499],[-0.0286357,1.4584112,-0.027503]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Set of left levatores costarum longi',
    'Muscular System',
    'BodyParts3D Concept: set of left levatores costarum longi (FMA74076)',
    'FMA74076',
    'FMA74076',
    '["FJ1463M"]'::jsonb,
    '[[0.0286357,1.1393212,-0.09570499],[0.0745211,1.4584112,-0.027503]]'::jsonb,
    'muscular',
    'set of left levatores costarum longi',
    '{"conceptId":"FMA74076","elements":["FJ1463M"],"system":"muscular","bounds":[[0.0286357,1.1393212,-0.09570499],[0.0745211,1.4584112,-0.027503]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Sternocostal part of right pectoralis major',
    'Upper Body',
    'BodyParts3D Concept: sternocostal part of right pectoralis major (FMA79979)',
    'FMA79979',
    'FMA79979',
    '["FJ1464"]'::jsonb,
    '[[-0.18784800000000001,1.2187211999999998,-0.019000000000000003],[-0.00481557,1.3919112,0.11935300000000001]]'::jsonb,
    'muscular',
    'sternocostal part of right pectoralis major',
    '{"conceptId":"FMA79979","elements":["FJ1464"],"system":"muscular","bounds":[[-0.18784800000000001,1.2187211999999998,-0.019000000000000003],[-0.00481557,1.3919112,0.11935300000000001]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Sternocostal part of left pectoralis major',
    'Upper Body',
    'BodyParts3D Concept: sternocostal part of left pectoralis major (FMA79980)',
    'FMA79980',
    'FMA79980',
    '["FJ1464M"]'::jsonb,
    '[[0.00481557,1.2187211999999998,-0.019000000000000003],[0.18784800000000001,1.3919112,0.11935300000000001]]'::jsonb,
    'muscular',
    'sternocostal part of left pectoralis major',
    '{"conceptId":"FMA79980","elements":["FJ1464M"],"system":"muscular","bounds":[[0.00481557,1.2187211999999998,-0.019000000000000003],[0.18784800000000001,1.3919112,0.11935300000000001]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Abductor digiti minimi of right hand',
    'Muscular System',
    'BodyParts3D Concept: abductor digiti minimi of right hand (FMA37396)',
    'FMA37396',
    'FMA37396',
    '["FJ1466"]'::jsonb,
    '[[-0.238181,0.8077472,0.030623999999999985],[-0.220817,0.8727932,0.048906000000000005]]'::jsonb,
    'muscular',
    'abductor digiti minimi of right hand',
    '{"conceptId":"FMA37396","elements":["FJ1466"],"system":"muscular","bounds":[[-0.238181,0.8077472,0.030623999999999985],[-0.220817,0.8727932,0.048906000000000005]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Abductor digiti minimi of left hand',
    'Muscular System',
    'BodyParts3D Concept: abductor digiti minimi of left hand (FMA37397)',
    'FMA37397',
    'FMA37397',
    '["FJ1466M"]'::jsonb,
    '[[0.220817,0.8077472,0.030623999999999985],[0.238181,0.8727932,0.048906000000000005]]'::jsonb,
    'muscular',
    'abductor digiti minimi of left hand',
    '{"conceptId":"FMA37397","elements":["FJ1466M"],"system":"muscular","bounds":[[0.220817,0.8077472,0.030623999999999985],[0.238181,0.8727932,0.048906000000000005]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Acromial part of right deltoid',
    'Upper Body',
    'BodyParts3D Concept: acromial part of right deltoid (FMA34682)',
    'FMA34682',
    'FMA34682',
    '["FJ1467"]'::jsonb,
    '[[-0.227228,1.2832012,-0.059162900000000004],[-0.14658600000000002,1.4273312,0.0033379999999999937]]'::jsonb,
    'muscular',
    'acromial part of right deltoid',
    '{"conceptId":"FMA34682","elements":["FJ1467"],"system":"muscular","bounds":[[-0.227228,1.2832012,-0.059162900000000004],[-0.14658600000000002,1.4273312,0.0033379999999999937]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Acromial part of left deltoid',
    'Upper Body',
    'BodyParts3D Concept: acromial part of left deltoid (FMA34683)',
    'FMA34683',
    'FMA34683',
    '["FJ1467M"]'::jsonb,
    '[[0.14658600000000002,1.2832012,-0.059162900000000004],[0.227228,1.4273312,0.0033370000000000066]]'::jsonb,
    'muscular',
    'acromial part of left deltoid',
    '{"conceptId":"FMA34683","elements":["FJ1467M"],"system":"muscular","bounds":[[0.14658600000000002,1.2832012,-0.059162900000000004],[0.227228,1.4273312,0.0033370000000000066]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Clavicular part of right deltoid',
    'Upper Body',
    'BodyParts3D Concept: clavicular part of right deltoid (FMA34680)',
    'FMA34680',
    'FMA34680',
    '["FJ1468"]'::jsonb,
    '[[-0.203619,1.2819611999999998,-0.024874800000000002],[-0.08855500000000001,1.4335012,0.021331000000000003]]'::jsonb,
    'muscular',
    'clavicular part of right deltoid',
    '{"conceptId":"FMA34680","elements":["FJ1468"],"system":"muscular","bounds":[[-0.203619,1.2819611999999998,-0.024874800000000002],[-0.08855500000000001,1.4335012,0.021331000000000003]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Clavicular part of left deltoid',
    'Upper Body',
    'BodyParts3D Concept: clavicular part of left deltoid (FMA34681)',
    'FMA34681',
    'FMA34681',
    '["FJ1468M"]'::jsonb,
    '[[0.08855500000000001,1.2819611999999998,-0.024874800000000002],[0.203619,1.4335012,0.021331000000000003]]'::jsonb,
    'muscular',
    'clavicular part of left deltoid',
    '{"conceptId":"FMA34681","elements":["FJ1468M"],"system":"muscular","bounds":[[0.08855500000000001,1.2819611999999998,-0.024874800000000002],[0.203619,1.4335012,0.021331000000000003]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left flexor pollicis brevis',
    'Upper Body',
    'BodyParts3D Concept: left flexor pollicis brevis (FMA37389)',
    'FMA37389',
    'FMA37389',
    '["FJ1469"]'::jsonb,
    '[[-0.30125,0.8446662,0.025252999999999998],[-0.256014,0.8721632000000001,0.053121]]'::jsonb,
    'muscular',
    'left flexor pollicis brevis',
    '{"conceptId":"FMA37389","elements":["FJ1469"],"system":"muscular","bounds":[[-0.30125,0.8446662,0.025252999999999998],[-0.256014,0.8721632000000001,0.053121]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right flexor pollicis brevis',
    'Upper Body',
    'BodyParts3D Concept: right flexor pollicis brevis (FMA37388)',
    'FMA37388',
    'FMA37388',
    '["FJ1469M"]'::jsonb,
    '[[0.256014,0.8446662,0.025252999999999998],[0.30125,0.8721642000000001,0.053121]]'::jsonb,
    'muscular',
    'right flexor pollicis brevis',
    '{"conceptId":"FMA37388","elements":["FJ1469M"],"system":"muscular","bounds":[[0.256014,0.8446662,0.025252999999999998],[0.30125,0.8721642000000001,0.053121]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Flexor digiti minimi brevis of right hand',
    'Muscular System',
    'BodyParts3D Concept: flexor digiti minimi brevis of right hand (FMA37398)',
    'FMA37398',
    'FMA37398',
    '["FJ1470"]'::jsonb,
    '[[-0.244008,0.8099002000000001,0.030711000000000016],[-0.226063,0.8700952000000001,0.048017000000000004]]'::jsonb,
    'muscular',
    'flexor digiti minimi brevis of right hand',
    '{"conceptId":"FMA37398","elements":["FJ1470"],"system":"muscular","bounds":[[-0.244008,0.8099002000000001,0.030711000000000016],[-0.226063,0.8700952000000001,0.048017000000000004]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Flexor digiti minimi brevis of left hand',
    'Muscular System',
    'BodyParts3D Concept: flexor digiti minimi brevis of left hand (FMA37399)',
    'FMA37399',
    'FMA37399',
    '["FJ1470M"]'::jsonb,
    '[[0.226063,0.8099002000000001,0.030711000000000016],[0.244008,0.8700952000000001,0.048017000000000004]]'::jsonb,
    'muscular',
    'flexor digiti minimi brevis of left hand',
    '{"conceptId":"FMA37399","elements":["FJ1470M"],"system":"muscular","bounds":[[0.226063,0.8099002000000001,0.030711000000000016],[0.244008,0.8700952000000001,0.048017000000000004]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right extensor carpi ulnaris',
    'Upper Body',
    'BodyParts3D Concept: right extensor carpi ulnaris (FMA38507)',
    'FMA38507',
    'FMA38507',
    '["FJ1472","FJ1517"]'::jsonb,
    '[[-0.23743,0.8492772000000001,-0.050315200000000004],[-0.219476,1.1369812,0.02679799999999999]]'::jsonb,
    'muscular',
    'right extensor carpi ulnaris',
    '{"conceptId":"FMA38507","elements":["FJ1472","FJ1517"],"system":"muscular","bounds":[[-0.23743,0.8492772000000001,-0.050315200000000004],[-0.219476,1.1369812,0.02679799999999999]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left extensor carpi ulnaris',
    'Upper Body',
    'BodyParts3D Concept: left extensor carpi ulnaris (FMA38508)',
    'FMA38508',
    'FMA38508',
    '["FJ1472M","FJ1517M"]'::jsonb,
    '[[0.219476,0.8492772000000001,-0.050315200000000004],[0.23743,1.1369812,0.026799000000000017]]'::jsonb,
    'muscular',
    'left extensor carpi ulnaris',
    '{"conceptId":"FMA38508","elements":["FJ1472M","FJ1517M"],"system":"muscular","bounds":[[0.219476,0.8492772000000001,-0.050315200000000004],[0.23743,1.1369812,0.026799000000000017]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Humeral head of right flexor carpi ulnaris',
    'Upper Body',
    'BodyParts3D Concept: humeral head of right flexor carpi ulnaris (FMA38617)',
    'FMA38617',
    'FMA38617',
    '["FJ1473"]'::jsonb,
    '[[-0.246452,0.8596652,-0.0388307],[-0.17782900000000001,1.1264512,0.03657400000000002]]'::jsonb,
    'muscular',
    'humeral head of right flexor carpi ulnaris',
    '{"conceptId":"FMA38617","elements":["FJ1473"],"system":"muscular","bounds":[[-0.246452,0.8596652,-0.0388307],[-0.17782900000000001,1.1264512,0.03657400000000002]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Humeral head of left flexor carpi ulnaris',
    'Upper Body',
    'BodyParts3D Concept: humeral head of left flexor carpi ulnaris (FMA38618)',
    'FMA38618',
    'FMA38618',
    '["FJ1473M"]'::jsonb,
    '[[0.17782900000000001,0.8596652,-0.0388307],[0.246452,1.1264512,0.03657400000000002]]'::jsonb,
    'muscular',
    'humeral head of left flexor carpi ulnaris',
    '{"conceptId":"FMA38618","elements":["FJ1473M"],"system":"muscular","bounds":[[0.17782900000000001,0.8596652,-0.0388307],[0.246452,1.1264512,0.03657400000000002]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Humeral head of right pronator teres',
    'Upper Body',
    'BodyParts3D Concept: humeral head of right pronator teres (FMA38560)',
    'FMA38560',
    'FMA38560',
    '["FJ1474"]'::jsonb,
    '[[-0.257321,0.9947632000000001,-0.0323113],[-0.187418,1.1434912000000002,0.0025529999999999997]]'::jsonb,
    'muscular',
    'humeral head of right pronator teres',
    '{"conceptId":"FMA38560","elements":["FJ1474"],"system":"muscular","bounds":[[-0.257321,0.9947632000000001,-0.0323113],[-0.187418,1.1434912000000002,0.0025529999999999997]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Humeral head of left pronator teres',
    'Upper Body',
    'BodyParts3D Concept: humeral head of left pronator teres (FMA38561)',
    'FMA38561',
    'FMA38561',
    '["FJ1474M"]'::jsonb,
    '[[0.187418,0.9947632000000001,-0.0323113],[0.257321,1.1434912000000002,0.0025529999999999997]]'::jsonb,
    'muscular',
    'humeral head of left pronator teres',
    '{"conceptId":"FMA38561","elements":["FJ1474M"],"system":"muscular","bounds":[[0.187418,0.9947632000000001,-0.0323113],[0.257321,1.1434912000000002,0.0025529999999999997]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right flexor digitorum superficialis',
    'Upper Body',
    'BodyParts3D Concept: right flexor digitorum superficialis (FMA38470)',
    'FMA38470',
    'FMA38470',
    '["FJ1475","FJ1499"]'::jsonb,
    '[[-0.30586900000000006,0.7539252000000001,-0.032421000000000005],[-0.178113,1.1311912,0.06784800000000002]]'::jsonb,
    'muscular',
    'right flexor digitorum superficialis',
    '{"conceptId":"FMA38470","elements":["FJ1475","FJ1499"],"system":"muscular","bounds":[[-0.30586900000000006,0.7539252000000001,-0.032421000000000005],[-0.178113,1.1311912,0.06784800000000002]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left flexor digitorum superficialis',
    'Upper Body',
    'BodyParts3D Concept: left flexor digitorum superficialis (FMA38471)',
    'FMA38471',
    'FMA38471',
    '["FJ1475M","FJ1499M"]'::jsonb,
    '[[0.178113,0.7539252000000001,-0.032421000000000005],[0.30586900000000006,1.1311912,0.06784800000000002]]'::jsonb,
    'muscular',
    'left flexor digitorum superficialis',
    '{"conceptId":"FMA38471","elements":["FJ1475M","FJ1499M"],"system":"muscular","bounds":[[0.178113,0.7539252000000001,-0.032421000000000005],[0.30586900000000006,1.1311912,0.06784800000000002]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Lateral head of right triceps brachii',
    'Upper Body',
    'BodyParts3D Concept: lateral head of right triceps brachii (FMA37697)',
    'FMA37697',
    'FMA37697',
    '["FJ1477"]'::jsonb,
    '[[-0.228005,1.1140812,-0.07991580000000001],[-0.174456,1.3702412000000002,-0.0312032]]'::jsonb,
    'muscular',
    'lateral head of right triceps brachii',
    '{"conceptId":"FMA37697","elements":["FJ1477"],"system":"muscular","bounds":[[-0.228005,1.1140812,-0.07991580000000001],[-0.174456,1.3702412000000002,-0.0312032]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Lateral head of left triceps brachii',
    'Upper Body',
    'BodyParts3D Concept: lateral head of left triceps brachii (FMA37698)',
    'FMA37698',
    'FMA37698',
    '["FJ1477M"]'::jsonb,
    '[[0.174456,1.1140812,-0.07991580000000001],[0.228005,1.3702412000000002,-0.0312032]]'::jsonb,
    'muscular',
    'lateral head of left triceps brachii',
    '{"conceptId":"FMA37698","elements":["FJ1477M"],"system":"muscular","bounds":[[0.174456,1.1140812,-0.07991580000000001],[0.228005,1.3702412000000002,-0.0312032]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Long head of right biceps brachii',
    'Upper Body',
    'BodyParts3D Concept: long head of right biceps brachii (FMA37686)',
    'FMA37686',
    'FMA37686',
    '["FJ1478"]'::jsonb,
    '[[-0.22986,1.0721832,-0.032191100000000014],[-0.135268,1.4175312,0.009291999999999995]]'::jsonb,
    'muscular',
    'long head of right biceps brachii',
    '{"conceptId":"FMA37686","elements":["FJ1478"],"system":"muscular","bounds":[[-0.22986,1.0721832,-0.032191100000000014],[-0.135268,1.4175312,0.009291999999999995]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Long head of left biceps brachii',
    'Upper Body',
    'BodyParts3D Concept: long head of left biceps brachii (FMA37687)',
    'FMA37687',
    'FMA37687',
    '["FJ1478M"]'::jsonb,
    '[[0.135268,1.0721832,-0.032191100000000014],[0.22986,1.4175312,0.00929300000000001]]'::jsonb,
    'muscular',
    'long head of left biceps brachii',
    '{"conceptId":"FMA37687","elements":["FJ1478M"],"system":"muscular","bounds":[[0.135268,1.0721832,-0.032191100000000014],[0.22986,1.4175312,0.00929300000000001]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Long head of right triceps brachii',
    'Upper Body',
    'BodyParts3D Concept: long head of right triceps brachii (FMA37699)',
    'FMA37699',
    'FMA37699',
    '["FJ1479"]'::jsonb,
    '[[-0.216462,1.1133511999999999,-0.08124050000000001],[-0.134691,1.3788612,-0.03589790000000001]]'::jsonb,
    'muscular',
    'long head of right triceps brachii',
    '{"conceptId":"FMA37699","elements":["FJ1479"],"system":"muscular","bounds":[[-0.216462,1.1133511999999999,-0.08124050000000001],[-0.134691,1.3788612,-0.03589790000000001]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Long head of left triceps brachii',
    'Upper Body',
    'BodyParts3D Concept: long head of left triceps brachii (FMA37700)',
    'FMA37700',
    'FMA37700',
    '["FJ1479M"]'::jsonb,
    '[[0.134691,1.1133511999999999,-0.0812404],[0.216462,1.3788612,-0.03589790000000001]]'::jsonb,
    'muscular',
    'long head of left triceps brachii',
    '{"conceptId":"FMA37700","elements":["FJ1479M"],"system":"muscular","bounds":[[0.134691,1.1133511999999999,-0.0812404],[0.216462,1.3788612,-0.03589790000000001]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Medial head of right triceps brachii',
    'Upper Body',
    'BodyParts3D Concept: medial head of right triceps brachii (FMA37695)',
    'FMA37695',
    'FMA37695',
    '["FJ1480"]'::jsonb,
    '[[-0.226963,1.1074612,-0.0536828],[-0.167373,1.3341512,-0.028120099999999995]]'::jsonb,
    'muscular',
    'medial head of right triceps brachii',
    '{"conceptId":"FMA37695","elements":["FJ1480"],"system":"muscular","bounds":[[-0.226963,1.1074612,-0.0536828],[-0.167373,1.3341512,-0.028120099999999995]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Medial head of left triceps brachii',
    'Upper Body',
    'BodyParts3D Concept: medial head of left triceps brachii (FMA37696)',
    'FMA37696',
    'FMA37696',
    '["FJ1480M"]'::jsonb,
    '[[0.167374,1.1074612,-0.0536828],[0.226963,1.3341512,-0.028120099999999995]]'::jsonb,
    'muscular',
    'medial head of left triceps brachii',
    '{"conceptId":"FMA37696","elements":["FJ1480M"],"system":"muscular","bounds":[[0.167374,1.1074612,-0.0536828],[0.226963,1.3341512,-0.028120099999999995]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Oblique head of right adductor pollicis',
    'Lower Body',
    'BodyParts3D Concept: oblique head of right adductor pollicis (FMA46121)',
    'FMA46121',
    'FMA46121',
    '["FJ1481"]'::jsonb,
    '[[-0.29933600000000005,0.8378602,0.023162000000000002],[-0.256534,0.8678952000000001,0.04707]]'::jsonb,
    'muscular',
    'oblique head of right adductor pollicis',
    '{"conceptId":"FMA46121","elements":["FJ1481"],"system":"muscular","bounds":[[-0.29933600000000005,0.8378602,0.023162000000000002],[-0.256534,0.8678952000000001,0.04707]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Oblique head of left adductor pollicis',
    'Lower Body',
    'BodyParts3D Concept: oblique head of left adductor pollicis (FMA46122)',
    'FMA46122',
    'FMA46122',
    '["FJ1481M"]'::jsonb,
    '[[0.256534,0.8378602,0.023162000000000002],[0.29933600000000005,0.8678952000000001,0.04707]]'::jsonb,
    'muscular',
    'oblique head of left adductor pollicis',
    '{"conceptId":"FMA46122","elements":["FJ1481M"],"system":"muscular","bounds":[[0.256534,0.8378602,0.023162000000000002],[0.29933600000000005,0.8678952000000001,0.04707]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Opponens digiti minimi of right hand',
    'Muscular System',
    'BodyParts3D Concept: opponens digiti minimi of right hand (FMA37400)',
    'FMA37400',
    'FMA37400',
    '["FJ1482"]'::jsonb,
    '[[-0.24541900000000003,0.8217412000000001,0.027634999999999993],[-0.227464,0.8685532,0.042573]]'::jsonb,
    'muscular',
    'opponens digiti minimi of right hand',
    '{"conceptId":"FMA37400","elements":["FJ1482"],"system":"muscular","bounds":[[-0.24541900000000003,0.8217412000000001,0.027634999999999993],[-0.227464,0.8685532,0.042573]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Opponens digiti minimi of left hand',
    'Muscular System',
    'BodyParts3D Concept: opponens digiti minimi of left hand (FMA37401)',
    'FMA37401',
    'FMA37401',
    '["FJ1482M"]'::jsonb,
    '[[0.227464,0.8217412000000001,0.027634999999999993],[0.24541900000000003,0.8685532,0.042573]]'::jsonb,
    'muscular',
    'opponens digiti minimi of left hand',
    '{"conceptId":"FMA37401","elements":["FJ1482M"],"system":"muscular","bounds":[[0.227464,0.8217412000000001,0.027634999999999993],[0.24541900000000003,0.8685532,0.042573]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right abductor pollicis brevis',
    'Upper Body',
    'BodyParts3D Concept: right abductor pollicis brevis (FMA37386)',
    'FMA37386',
    'FMA37386',
    '["FJ1483"]'::jsonb,
    '[[-0.302539,0.8480222000000001,0.023022999999999988],[-0.263352,0.8861982,0.052742999999999984]]'::jsonb,
    'muscular',
    'right abductor pollicis brevis',
    '{"conceptId":"FMA37386","elements":["FJ1483"],"system":"muscular","bounds":[[-0.302539,0.8480222000000001,0.023022999999999988],[-0.263352,0.8861982,0.052742999999999984]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left abductor pollicis brevis',
    'Upper Body',
    'BodyParts3D Concept: left abductor pollicis brevis (FMA37387)',
    'FMA37387',
    'FMA37387',
    '["FJ1483M"]'::jsonb,
    '[[0.263352,0.8480222000000001,0.023022999999999988],[0.302539,0.8861982,0.052742999999999984]]'::jsonb,
    'muscular',
    'left abductor pollicis brevis',
    '{"conceptId":"FMA37387","elements":["FJ1483M"],"system":"muscular","bounds":[[0.263352,0.8480222000000001,0.023022999999999988],[0.302539,0.8861982,0.052742999999999984]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right abductor pollicis longus',
    'Upper Body',
    'BodyParts3D Concept: right abductor pollicis longus (FMA38516)',
    'FMA38516',
    'FMA38516',
    '["FJ1484"]'::jsonb,
    '[[-0.289429,0.8668602000000001,-0.029950599999999994],[-0.227545,1.0488861999999999,0.03177699999999997]]'::jsonb,
    'muscular',
    'right abductor pollicis longus',
    '{"conceptId":"FMA38516","elements":["FJ1484"],"system":"muscular","bounds":[[-0.289429,0.8668602000000001,-0.029950599999999994],[-0.227545,1.0488861999999999,0.03177699999999997]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left abductor pollicis longus',
    'Upper Body',
    'BodyParts3D Concept: left abductor pollicis longus (FMA38517)',
    'FMA38517',
    'FMA38517',
    '["FJ1484M"]'::jsonb,
    '[[0.227545,0.8668602000000001,-0.029950599999999994],[0.289429,1.0488861999999999,0.03177699999999997]]'::jsonb,
    'muscular',
    'left abductor pollicis longus',
    '{"conceptId":"FMA38517","elements":["FJ1484M"],"system":"muscular","bounds":[[0.227545,0.8668602000000001,-0.029950599999999994],[0.289429,1.0488861999999999,0.03177699999999997]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right anconeus',
    'Muscular System',
    'BodyParts3D Concept: right anconeus (FMA37705)',
    'FMA37705',
    'FMA37705',
    '["FJ1485"]'::jsonb,
    '[[-0.22930799999999998,1.0376442000000001,-0.058177900000000005],[-0.20633600000000002,1.1390012,-0.032982]]'::jsonb,
    'muscular',
    'right anconeus',
    '{"conceptId":"FMA37705","elements":["FJ1485"],"system":"muscular","bounds":[[-0.22930799999999998,1.0376442000000001,-0.058177900000000005],[-0.20633600000000002,1.1390012,-0.032982]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left anconeus',
    'Muscular System',
    'BodyParts3D Concept: left anconeus (FMA37706)',
    'FMA37706',
    'FMA37706',
    '["FJ1485M"]'::jsonb,
    '[[0.20633600000000002,1.0376442000000001,-0.058177900000000005],[0.22930799999999998,1.1390012,-0.032982]]'::jsonb,
    'muscular',
    'left anconeus',
    '{"conceptId":"FMA37706","elements":["FJ1485M"],"system":"muscular","bounds":[[0.20633600000000002,1.0376442000000001,-0.058177900000000005],[0.22930799999999998,1.1390012,-0.032982]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right brachialis',
    'Upper Body',
    'BodyParts3D Concept: right brachialis (FMA37668)',
    'FMA37668',
    'FMA37668',
    '["FJ1486"]'::jsonb,
    '[[-0.23512100000000002,1.0734722,-0.03943030000000001],[-0.176385,1.2983112,-0.013604000000000005]]'::jsonb,
    'muscular',
    'right brachialis',
    '{"conceptId":"FMA37668","elements":["FJ1486"],"system":"muscular","bounds":[[-0.23512100000000002,1.0734722,-0.03943030000000001],[-0.176385,1.2983112,-0.013604000000000005]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left brachialis',
    'Upper Body',
    'BodyParts3D Concept: left brachialis (FMA37669)',
    'FMA37669',
    'FMA37669',
    '["FJ1486M"]'::jsonb,
    '[[0.176385,1.0734722,-0.03943030000000001],[0.23512100000000002,1.2983112,-0.013604100000000008]]'::jsonb,
    'muscular',
    'left brachialis',
    '{"conceptId":"FMA37669","elements":["FJ1486M"],"system":"muscular","bounds":[[0.176385,1.0734722,-0.03943030000000001],[0.23512100000000002,1.2983112,-0.013604100000000008]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right brachioradialis',
    'Upper Body',
    'BodyParts3D Concept: right brachioradialis (FMA38486)',
    'FMA38486',
    'FMA38486',
    '["FJ1487"]'::jsonb,
    '[[-0.280586,0.8878232,-0.04417560000000001],[-0.20815899999999998,1.2257212,0.022877999999999996]]'::jsonb,
    'muscular',
    'right brachioradialis',
    '{"conceptId":"FMA38486","elements":["FJ1487"],"system":"muscular","bounds":[[-0.280586,0.8878232,-0.04417560000000001],[-0.20815899999999998,1.2257212,0.022877999999999996]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left brachioradialis',
    'Upper Body',
    'BodyParts3D Concept: left brachioradialis (FMA38487)',
    'FMA38487',
    'FMA38487',
    '["FJ1487M"]'::jsonb,
    '[[0.20815899999999998,0.8878232,-0.04417560000000001],[0.280586,1.2257212,0.022877999999999996]]'::jsonb,
    'muscular',
    'left brachioradialis',
    '{"conceptId":"FMA38487","elements":["FJ1487M"],"system":"muscular","bounds":[[0.20815899999999998,0.8878232,-0.04417560000000001],[0.280586,1.2257212,0.022877999999999996]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right coracobrachialis',
    'Upper Body',
    'BodyParts3D Concept: right coracobrachialis (FMA37665)',
    'FMA37665',
    'FMA37665',
    '["FJ1488"]'::jsonb,
    '[[-0.18942599999999998,1.2482412,-0.0331395],[-0.13015100000000002,1.4059811999999998,0.006175]]'::jsonb,
    'muscular',
    'right coracobrachialis',
    '{"conceptId":"FMA37665","elements":["FJ1488"],"system":"muscular","bounds":[[-0.18942599999999998,1.2482412,-0.0331395],[-0.13015100000000002,1.4059811999999998,0.006175]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left coracobrachialis',
    'Upper Body',
    'BodyParts3D Concept: left coracobrachialis (FMA37666)',
    'FMA37666',
    'FMA37666',
    '["FJ1488M"]'::jsonb,
    '[[0.13015100000000002,1.2482412,-0.0331395],[0.18942599999999998,1.4059811999999998,0.006175]]'::jsonb,
    'muscular',
    'left coracobrachialis',
    '{"conceptId":"FMA37666","elements":["FJ1488M"],"system":"muscular","bounds":[[0.13015100000000002,1.2482412,-0.0331395],[0.18942599999999998,1.4059811999999998,0.006175]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right extensor carpi radialis brevis',
    'Upper Body',
    'BodyParts3D Concept: right extensor carpi radialis brevis (FMA38498)',
    'FMA38498',
    'FMA38498',
    '["FJ1489"]'::jsonb,
    '[[-0.272638,0.8541662,-0.04973910000000001],[-0.228364,1.1568212,0.015742999999999993]]'::jsonb,
    'muscular',
    'right extensor carpi radialis brevis',
    '{"conceptId":"FMA38498","elements":["FJ1489"],"system":"muscular","bounds":[[-0.272638,0.8541662,-0.04973910000000001],[-0.228364,1.1568212,0.015742999999999993]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left extensor carpi radialis brevis',
    'Upper Body',
    'BodyParts3D Concept: left extensor carpi radialis brevis (FMA38499)',
    'FMA38499',
    'FMA38499',
    '["FJ1489M"]'::jsonb,
    '[[0.228364,0.8541662,-0.04973910000000001],[0.272638,1.1568212,0.015742999999999993]]'::jsonb,
    'muscular',
    'left extensor carpi radialis brevis',
    '{"conceptId":"FMA38499","elements":["FJ1489M"],"system":"muscular","bounds":[[0.228364,0.8541662,-0.04973910000000001],[0.272638,1.1568212,0.015742999999999993]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right extensor carpi radialis longus',
    'Upper Body',
    'BodyParts3D Concept: right extensor carpi radialis longus (FMA38495)',
    'FMA38495',
    'FMA38495',
    '["FJ1490"]'::jsonb,
    '[[-0.277863,0.8572552000000001,-0.046794100000000005],[-0.220086,1.1797212,0.020978999999999998]]'::jsonb,
    'muscular',
    'right extensor carpi radialis longus',
    '{"conceptId":"FMA38495","elements":["FJ1490"],"system":"muscular","bounds":[[-0.277863,0.8572552000000001,-0.046794100000000005],[-0.220086,1.1797212,0.020978999999999998]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left extensor carpi radialis longus',
    'Upper Body',
    'BodyParts3D Concept: left extensor carpi radialis longus (FMA38496)',
    'FMA38496',
    'FMA38496',
    '["FJ1490M"]'::jsonb,
    '[[0.220068,0.8572552000000001,-0.046794100000000005],[0.277863,1.1797212,0.020978999999999998]]'::jsonb,
    'muscular',
    'left extensor carpi radialis longus',
    '{"conceptId":"FMA38496","elements":["FJ1490M"],"system":"muscular","bounds":[[0.220068,0.8572552000000001,-0.046794100000000005],[0.277863,1.1797212,0.020978999999999998]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right extensor digiti minimi',
    'Muscular System',
    'BodyParts3D Concept: right extensor digiti minimi (FMA38504)',
    'FMA38504',
    'FMA38504',
    '["FJ1491"]'::jsonb,
    '[[-0.24322200000000002,0.8027792,-0.0460751],[-0.226988,1.1277312,0.04325399999999999]]'::jsonb,
    'muscular',
    'right extensor digiti minimi',
    '{"conceptId":"FMA38504","elements":["FJ1491"],"system":"muscular","bounds":[[-0.24322200000000002,0.8027792,-0.0460751],[-0.226988,1.1277312,0.04325399999999999]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left extensor digiti minimi',
    'Muscular System',
    'BodyParts3D Concept: left extensor digiti minimi (FMA38505)',
    'FMA38505',
    'FMA38505',
    '["FJ1491M"]'::jsonb,
    '[[0.226988,0.8027792,-0.0460751],[0.24322200000000002,1.1277312,0.04325499999999999]]'::jsonb,
    'muscular',
    'left extensor digiti minimi',
    '{"conceptId":"FMA38505","elements":["FJ1491M"],"system":"muscular","bounds":[[0.226988,0.8027792,-0.0460751],[0.24322200000000002,1.1277312,0.04325499999999999]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right extensor digitorum',
    'Upper Body',
    'BodyParts3D Concept: right extensor digitorum (FMA38501)',
    'FMA38501',
    'FMA38501',
    '["FJ1492"]'::jsonb,
    '[[-0.305054,0.7560922000000001,-0.05468730000000001],[-0.222476,1.1380712,0.062529]]'::jsonb,
    'muscular',
    'right extensor digitorum',
    '{"conceptId":"FMA38501","elements":["FJ1492"],"system":"muscular","bounds":[[-0.305054,0.7560922000000001,-0.05468730000000001],[-0.222476,1.1380712,0.062529]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left extensor digitorum',
    'Upper Body',
    'BodyParts3D Concept: left extensor digitorum (FMA38502)',
    'FMA38502',
    'FMA38502',
    '["FJ1492M"]'::jsonb,
    '[[0.222477,0.7560922000000001,-0.05468730000000001],[0.305054,1.1380712,0.062529]]'::jsonb,
    'muscular',
    'left extensor digitorum',
    '{"conceptId":"FMA38502","elements":["FJ1492M"],"system":"muscular","bounds":[[0.222477,0.7560922000000001,-0.05468730000000001],[0.305054,1.1380712,0.062529]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right extensor indicis',
    'Muscular System',
    'BodyParts3D Concept: right extensor indicis (FMA38525)',
    'FMA38525',
    'FMA38525',
    '["FJ1493"]'::jsonb,
    '[[-0.307647,0.7468192,-0.004713700000000001],[-0.229502,0.9463682,0.073595]]'::jsonb,
    'muscular',
    'right extensor indicis',
    '{"conceptId":"FMA38525","elements":["FJ1493"],"system":"muscular","bounds":[[-0.307647,0.7468192,-0.004713700000000001],[-0.229502,0.9463682,0.073595]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left extensor indicis',
    'Muscular System',
    'BodyParts3D Concept: left extensor indicis (FMA38526)',
    'FMA38526',
    'FMA38526',
    '["FJ1493M"]'::jsonb,
    '[[0.229502,0.7468192,-0.004713700000000001],[0.307647,0.9463682,0.073595]]'::jsonb,
    'muscular',
    'left extensor indicis',
    '{"conceptId":"FMA38526","elements":["FJ1493M"],"system":"muscular","bounds":[[0.229502,0.7468192,-0.004713700000000001],[0.307647,0.9463682,0.073595]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right extensor pollicis brevis',
    'Upper Body',
    'BodyParts3D Concept: right extensor pollicis brevis (FMA38519)',
    'FMA38519',
    'FMA38519',
    '["FJ1494"]'::jsonb,
    '[[-0.311402,0.8365492000000001,-0.0090953],[-0.234923,0.9721062,0.047653]]'::jsonb,
    'muscular',
    'right extensor pollicis brevis',
    '{"conceptId":"FMA38519","elements":["FJ1494"],"system":"muscular","bounds":[[-0.311402,0.8365492000000001,-0.0090953],[-0.234923,0.9721062,0.047653]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left extensor pollicis brevis',
    'Upper Body',
    'BodyParts3D Concept: left extensor pollicis brevis (FMA38520)',
    'FMA38520',
    'FMA38520',
    '["FJ1494M"]'::jsonb,
    '[[0.234923,0.8365492000000001,-0.0090953],[0.311402,0.9721062,0.047653]]'::jsonb,
    'muscular',
    'left extensor pollicis brevis',
    '{"conceptId":"FMA38520","elements":["FJ1494M"],"system":"muscular","bounds":[[0.234923,0.8365492000000001,-0.0090953],[0.311402,0.9721062,0.047653]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right extensor pollicis longus',
    'Upper Body',
    'BodyParts3D Concept: right extensor pollicis longus (FMA38522)',
    'FMA38522',
    'FMA38522',
    '["FJ1495"]'::jsonb,
    '[[-0.319379,0.8111482000000001,-0.024310100000000015],[-0.224628,1.0132002,0.06337499999999999]]'::jsonb,
    'muscular',
    'right extensor pollicis longus',
    '{"conceptId":"FMA38522","elements":["FJ1495"],"system":"muscular","bounds":[[-0.319379,0.8111482000000001,-0.024310100000000015],[-0.224628,1.0132002,0.06337499999999999]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left extensor pollicis longus',
    'Upper Body',
    'BodyParts3D Concept: left extensor pollicis longus (FMA38523)',
    'FMA38523',
    'FMA38523',
    '["FJ1495M"]'::jsonb,
    '[[0.224628,0.8111482000000001,-0.024310100000000015],[0.319379,1.0132002,0.06337499999999999]]'::jsonb,
    'muscular',
    'left extensor pollicis longus',
    '{"conceptId":"FMA38523","elements":["FJ1495M"],"system":"muscular","bounds":[[0.224628,0.8111482000000001,-0.024310100000000015],[0.319379,1.0132002,0.06337499999999999]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right flexor carpi radialis',
    'Upper Body',
    'BodyParts3D Concept: right flexor carpi radialis (FMA38460)',
    'FMA38460',
    'FMA38460',
    '["FJ1496"]'::jsonb,
    '[[-0.272111,0.8588082,-0.0291323],[-0.18436000000000002,1.1355912,0.036405999999999994]]'::jsonb,
    'muscular',
    'right flexor carpi radialis',
    '{"conceptId":"FMA38460","elements":["FJ1496"],"system":"muscular","bounds":[[-0.272111,0.8588082,-0.0291323],[-0.18436000000000002,1.1355912,0.036405999999999994]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left flexor carpi radialis',
    'Upper Body',
    'BodyParts3D Concept: left flexor carpi radialis (FMA38461)',
    'FMA38461',
    'FMA38461',
    '["FJ1496M"]'::jsonb,
    '[[0.18436000000000002,0.8588082,-0.0291323],[0.272111,1.1355912,0.036406999999999995]]'::jsonb,
    'muscular',
    'left flexor carpi radialis',
    '{"conceptId":"FMA38461","elements":["FJ1496M"],"system":"muscular","bounds":[[0.18436000000000002,0.8588082,-0.0291323],[0.272111,1.1355912,0.036406999999999995]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right flexor digitorum profundus',
    'Upper Body',
    'BodyParts3D Concept: right flexor digitorum profundus (FMA38479)',
    'FMA38479',
    'FMA38479',
    '["FJ1497"]'::jsonb,
    '[[-0.30693200000000004,0.7436472,-0.0312722],[-0.203877,1.0969712,0.08687799999999998]]'::jsonb,
    'muscular',
    'right flexor digitorum profundus',
    '{"conceptId":"FMA38479","elements":["FJ1497"],"system":"muscular","bounds":[[-0.30693200000000004,0.7436472,-0.0312722],[-0.203877,1.0969712,0.08687799999999998]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left flexor digitorum profundus',
    'Upper Body',
    'BodyParts3D Concept: left flexor digitorum profundus (FMA38480)',
    'FMA38480',
    'FMA38480',
    '["FJ1497M"]'::jsonb,
    '[[0.203877,0.7436472,-0.0312722],[0.30693200000000004,1.0969712,0.08687799999999998]]'::jsonb,
    'muscular',
    'left flexor digitorum profundus',
    '{"conceptId":"FMA38480","elements":["FJ1497M"],"system":"muscular","bounds":[[0.203877,0.7436472,-0.0312722],[0.30693200000000004,1.0969712,0.08687799999999998]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right flexor pollicis longus',
    'Upper Body',
    'BodyParts3D Concept: right flexor pollicis longus (FMA38482)',
    'FMA38482',
    'FMA38482',
    '["FJ1498"]'::jsonb,
    '[[-0.31405099999999997,0.8133272,-0.01236820000000001],[-0.238495,1.0440202,0.065883]]'::jsonb,
    'muscular',
    'right flexor pollicis longus',
    '{"conceptId":"FMA38482","elements":["FJ1498"],"system":"muscular","bounds":[[-0.31405099999999997,0.8133272,-0.01236820000000001],[-0.238495,1.0440202,0.065883]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left flexor pollicis longus',
    'Upper Body',
    'BodyParts3D Concept: left flexor pollicis longus (FMA38484)',
    'FMA38484',
    'FMA38484',
    '["FJ1498M"]'::jsonb,
    '[[0.238495,0.8133272,-0.01236820000000001],[0.31405099999999997,1.0440202,0.065883]]'::jsonb,
    'muscular',
    'left flexor pollicis longus',
    '{"conceptId":"FMA38484","elements":["FJ1498M"],"system":"muscular","bounds":[[0.238495,0.8133272,-0.01236820000000001],[0.31405099999999997,1.0440202,0.065883]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right infraspinatus muscle',
    'Upper Body',
    'BodyParts3D Concept: right infraspinatus muscle (FMA32547)',
    'FMA32547',
    'FMA32547',
    '["FJ1500"]'::jsonb,
    '[[-0.18905000000000002,1.2846412,-0.10366613000000001],[-0.060258400000000004,1.4090812,-0.022913000000000003]]'::jsonb,
    'muscular',
    'right infraspinatus muscle',
    '{"conceptId":"FMA32547","elements":["FJ1500"],"system":"muscular","bounds":[[-0.18905000000000002,1.2846412,-0.10366613000000001],[-0.060258400000000004,1.4090812,-0.022913000000000003]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left infraspinatus muscle',
    'Upper Body',
    'BodyParts3D Concept: left infraspinatus muscle (FMA32548)',
    'FMA32548',
    'FMA32548',
    '["FJ1500M"]'::jsonb,
    '[[0.060258400000000004,1.2846412,-0.10366613000000001],[0.18905000000000002,1.4090912,-0.022913000000000003]]'::jsonb,
    'muscular',
    'left infraspinatus muscle',
    '{"conceptId":"FMA32548","elements":["FJ1500M"],"system":"muscular","bounds":[[0.060258400000000004,1.2846412,-0.10366613000000001],[0.18905000000000002,1.4090912,-0.022913000000000003]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right opponens pollicis',
    'Upper Body',
    'BodyParts3D Concept: right opponens pollicis (FMA37390)',
    'FMA37390',
    'FMA37390',
    '["FJ1501"]'::jsonb,
    '[[-0.30586,0.8519412000000001,0.03037899999999999],[-0.258041,0.8841142000000001,0.048968999999999985]]'::jsonb,
    'muscular',
    'right opponens pollicis',
    '{"conceptId":"FMA37390","elements":["FJ1501"],"system":"muscular","bounds":[[-0.30586,0.8519412000000001,0.03037899999999999],[-0.258041,0.8841142000000001,0.048968999999999985]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left opponens pollicis',
    'Upper Body',
    'BodyParts3D Concept: left opponens pollicis (FMA37391)',
    'FMA37391',
    'FMA37391',
    '["FJ1501M"]'::jsonb,
    '[[0.258041,0.8519412000000001,0.03037899999999999],[0.30586,0.8841142000000001,0.048968999999999985]]'::jsonb,
    'muscular',
    'left opponens pollicis',
    '{"conceptId":"FMA37391","elements":["FJ1501M"],"system":"muscular","bounds":[[0.258041,0.8519412000000001,0.03037899999999999],[0.30586,0.8841142000000001,0.048968999999999985]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right palmaris longus',
    'Muscular System',
    'BodyParts3D Concept: right palmaris longus (FMA38463)',
    'FMA38463',
    'FMA38463',
    '["FJ1502"]'::jsonb,
    '[[-0.29062,0.8111182,-0.028390600000000016],[-0.179428,1.1319112,0.049692000000000014]]'::jsonb,
    'muscular',
    'right palmaris longus',
    '{"conceptId":"FMA38463","elements":["FJ1502"],"system":"muscular","bounds":[[-0.29062,0.8111182,-0.028390600000000016],[-0.179428,1.1319112,0.049692000000000014]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left palmaris longus',
    'Muscular System',
    'BodyParts3D Concept: left palmaris longus (FMA38464)',
    'FMA38464',
    'FMA38464',
    '["FJ1502M"]'::jsonb,
    '[[0.179427,0.8111182,-0.028390600000000016],[0.29062,1.1319112,0.049692000000000014]]'::jsonb,
    'muscular',
    'left palmaris longus',
    '{"conceptId":"FMA38464","elements":["FJ1502M"],"system":"muscular","bounds":[[0.179427,0.8111182,-0.028390600000000016],[0.29062,1.1319112,0.049692000000000014]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right pronator quadratus',
    'Upper Body',
    'BodyParts3D Concept: right pronator quadratus (FMA38454)',
    'FMA38454',
    'FMA38454',
    '["FJ1503"]'::jsonb,
    '[[-0.27176799999999995,0.8985662000000001,0.0025519999999999987],[-0.226095,0.9486822000000001,0.026180999999999982]]'::jsonb,
    'muscular',
    'right pronator quadratus',
    '{"conceptId":"FMA38454","elements":["FJ1503"],"system":"muscular","bounds":[[-0.27176799999999995,0.8985662000000001,0.0025519999999999987],[-0.226095,0.9486822000000001,0.026180999999999982]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left pronator quadratus',
    'Upper Body',
    'BodyParts3D Concept: left pronator quadratus (FMA38455)',
    'FMA38455',
    'FMA38455',
    '["FJ1503M"]'::jsonb,
    '[[0.226095,0.8985662000000001,0.0025509999999999977],[0.27176799999999995,0.9486822000000001,0.026180999999999982]]'::jsonb,
    'muscular',
    'left pronator quadratus',
    '{"conceptId":"FMA38455","elements":["FJ1503M"],"system":"muscular","bounds":[[0.226095,0.8985662000000001,0.0025509999999999977],[0.27176799999999995,0.9486822000000001,0.026180999999999982]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right supinator',
    'Upper Body',
    'BodyParts3D Concept: right supinator (FMA38513)',
    'FMA38513',
    'FMA38513',
    '["FJ1505"]'::jsonb,
    '[[-0.254094,1.0106452,-0.043739400000000005],[-0.222361,1.1344912,-0.009451200000000007]]'::jsonb,
    'muscular',
    'right supinator',
    '{"conceptId":"FMA38513","elements":["FJ1505"],"system":"muscular","bounds":[[-0.254094,1.0106452,-0.043739400000000005],[-0.222361,1.1344912,-0.009451200000000007]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left supinator',
    'Upper Body',
    'BodyParts3D Concept: left supinator (FMA38514)',
    'FMA38514',
    'FMA38514',
    '["FJ1505M"]'::jsonb,
    '[[0.222361,1.0106452,-0.043739400000000005],[0.254095,1.1344912,-0.009451200000000007]]'::jsonb,
    'muscular',
    'left supinator',
    '{"conceptId":"FMA38514","elements":["FJ1505M"],"system":"muscular","bounds":[[0.222361,1.0106452,-0.043739400000000005],[0.254095,1.1344912,-0.009451200000000007]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right supraspinatus',
    'Upper Body',
    'BodyParts3D Concept: right supraspinatus (FMA32544)',
    'FMA32544',
    'FMA32544',
    '["FJ1506"]'::jsonb,
    '[[-0.18844300000000003,1.3854511999999999,-0.08703870000000001],[-0.063876,1.4204712,-0.0080987]]'::jsonb,
    'muscular',
    'right supraspinatus',
    '{"conceptId":"FMA32544","elements":["FJ1506"],"system":"muscular","bounds":[[-0.18844300000000003,1.3854511999999999,-0.08703870000000001],[-0.063876,1.4204712,-0.0080987]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left supraspinatus',
    'Upper Body',
    'BodyParts3D Concept: left supraspinatus (FMA32545)',
    'FMA32545',
    'FMA32545',
    '["FJ1506M"]'::jsonb,
    '[[0.063876,1.3854511999999999,-0.08703870000000001],[0.18844300000000003,1.4204811999999998,-0.0080987]]'::jsonb,
    'muscular',
    'left supraspinatus',
    '{"conceptId":"FMA32545","elements":["FJ1506M"],"system":"muscular","bounds":[[0.063876,1.3854511999999999,-0.08703870000000001],[0.18844300000000003,1.4204811999999998,-0.0080987]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right teres major',
    'Upper Body',
    'BodyParts3D Concept: right teres major (FMA32551)',
    'FMA32551',
    'FMA32551',
    '["FJ1507"]'::jsonb,
    '[[-0.172209,1.2677612,-0.10155565000000001],[-0.0861425,1.3634612,-0.020443100000000006]]'::jsonb,
    'muscular',
    'right teres major',
    '{"conceptId":"FMA32551","elements":["FJ1507"],"system":"muscular","bounds":[[-0.172209,1.2677612,-0.10155565000000001],[-0.0861425,1.3634612,-0.020443100000000006]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left teres major',
    'Upper Body',
    'BodyParts3D Concept: left teres major (FMA32552)',
    'FMA32552',
    'FMA32552',
    '["FJ1507M"]'::jsonb,
    '[[0.0861425,1.2677612,-0.10155565000000001],[0.172209,1.3634612,-0.020443100000000006]]'::jsonb,
    'muscular',
    'left teres major',
    '{"conceptId":"FMA32552","elements":["FJ1507M"],"system":"muscular","bounds":[[0.0861425,1.2677612,-0.10155565000000001],[0.172209,1.3634612,-0.020443100000000006]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right teres minor',
    'Upper Body',
    'BodyParts3D Concept: right teres minor (FMA32553)',
    'FMA32553',
    'FMA32553',
    '["FJ1508"]'::jsonb,
    '[[-0.190554,1.2986711999999998,-0.0875938],[-0.105409,1.3950312,-0.01968940000000001]]'::jsonb,
    'muscular',
    'right teres minor',
    '{"conceptId":"FMA32553","elements":["FJ1508"],"system":"muscular","bounds":[[-0.190554,1.2986711999999998,-0.0875938],[-0.105409,1.3950312,-0.01968940000000001]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left teres minor',
    'Upper Body',
    'BodyParts3D Concept: left teres minor (FMA32554)',
    'FMA32554',
    'FMA32554',
    '["FJ1508M"]'::jsonb,
    '[[0.105409,1.2986711999999998,-0.0875938],[0.190555,1.3950312,-0.01968940000000001]]'::jsonb,
    'muscular',
    'left teres minor',
    '{"conceptId":"FMA32554","elements":["FJ1508M"],"system":"muscular","bounds":[[0.105409,1.2986711999999998,-0.0875938],[0.190555,1.3950312,-0.01968940000000001]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Set of dorsal interossei of right hand',
    'Muscular System',
    'BodyParts3D Concept: set of dorsal interossei of right hand (FMA42404)',
    'FMA42404',
    'FMA42404',
    '["FJ1509"]'::jsonb,
    '[[-0.296951,0.7947922000000001,0.019123999999999988],[-0.23525100000000002,0.8636662,0.044861999999999985]]'::jsonb,
    'muscular',
    'set of dorsal interossei of right hand',
    '{"conceptId":"FMA42404","elements":["FJ1509"],"system":"muscular","bounds":[[-0.296951,0.7947922000000001,0.019123999999999988],[-0.23525100000000002,0.8636662,0.044861999999999985]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Set of dorsal interossei of left hand',
    'Muscular System',
    'BodyParts3D Concept: set of dorsal interossei of left hand (FMA42405)',
    'FMA42405',
    'FMA42405',
    '["FJ1509M"]'::jsonb,
    '[[0.23525100000000002,0.7947922000000001,0.019123999999999988],[0.296951,0.8636662,0.044861999999999985]]'::jsonb,
    'muscular',
    'set of dorsal interossei of left hand',
    '{"conceptId":"FMA42405","elements":["FJ1509M"],"system":"muscular","bounds":[[0.23525100000000002,0.7947922000000001,0.019123999999999988],[0.296951,0.8636662,0.044861999999999985]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Set of lumbricals of right hand',
    'Muscular System',
    'BodyParts3D Concept: set of lumbricals of right hand (FMA42398)',
    'FMA42398',
    'FMA42398',
    '["FJ1510"]'::jsonb,
    '[[-0.300038,0.7629932,0.026894],[-0.22416999999999998,0.8530192000000001,0.058277999999999996]]'::jsonb,
    'muscular',
    'set of lumbricals of right hand',
    '{"conceptId":"FMA42398","elements":["FJ1510"],"system":"muscular","bounds":[[-0.300038,0.7629932,0.026894],[-0.22416999999999998,0.8530192000000001,0.058277999999999996]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Set of lumbricals of left hand',
    'Muscular System',
    'BodyParts3D Concept: set of lumbricals of left hand (FMA42399)',
    'FMA42399',
    'FMA42399',
    '["FJ1510M"]'::jsonb,
    '[[0.22416999999999998,0.7629932,0.026894],[0.300038,0.8530192000000001,0.058277999999999996]]'::jsonb,
    'muscular',
    'set of lumbricals of left hand',
    '{"conceptId":"FMA42399","elements":["FJ1510M"],"system":"muscular","bounds":[[0.22416999999999998,0.7629932,0.026894],[0.300038,0.8530192000000001,0.058277999999999996]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Set of palmar interossei of right hand',
    'Muscular System',
    'BodyParts3D Concept: set of palmar interossei of right hand (FMA42402)',
    'FMA42402',
    'FMA42402',
    '["FJ1511"]'::jsonb,
    '[[-0.281469,0.7937172,0.024321999999999996],[-0.23420500000000002,0.8451872000000001,0.046473000000000014]]'::jsonb,
    'muscular',
    'set of palmar interossei of right hand',
    '{"conceptId":"FMA42402","elements":["FJ1511"],"system":"muscular","bounds":[[-0.281469,0.7937172,0.024321999999999996],[-0.23420500000000002,0.8451872000000001,0.046473000000000014]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Set of palmar interossei of left hand',
    'Muscular System',
    'BodyParts3D Concept: set of palmar interossei of left hand (FMA42403)',
    'FMA42403',
    'FMA42403',
    '["FJ1511M"]'::jsonb,
    '[[0.23420500000000002,0.7937172,0.024321999999999996],[0.281469,0.8451872000000001,0.046473000000000014]]'::jsonb,
    'muscular',
    'set of palmar interossei of left hand',
    '{"conceptId":"FMA42403","elements":["FJ1511M"],"system":"muscular","bounds":[[0.23420500000000002,0.7937172,0.024321999999999996],[0.281469,0.8451872000000001,0.046473000000000014]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Short head of right biceps brachii',
    'Upper Body',
    'BodyParts3D Concept: short head of right biceps brachii (FMA37684)',
    'FMA37684',
    'FMA37684',
    '["FJ1512"]'::jsonb,
    '[[-0.21239,1.1433312,-0.024041900000000005],[-0.135237,1.4058712,0.009100999999999998]]'::jsonb,
    'muscular',
    'short head of right biceps brachii',
    '{"conceptId":"FMA37684","elements":["FJ1512"],"system":"muscular","bounds":[[-0.21239,1.1433312,-0.024041900000000005],[-0.135237,1.4058712,0.009100999999999998]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Short head of left biceps brachii',
    'Upper Body',
    'BodyParts3D Concept: short head of left biceps brachii (FMA37685)',
    'FMA37685',
    'FMA37685',
    '["FJ1512M"]'::jsonb,
    '[[0.135237,1.1433312,-0.024041900000000005],[0.21239,1.4058712,0.009101999999999999]]'::jsonb,
    'muscular',
    'short head of left biceps brachii',
    '{"conceptId":"FMA37685","elements":["FJ1512M"],"system":"muscular","bounds":[[0.135237,1.1433312,-0.024041900000000005],[0.21239,1.4058712,0.009101999999999999]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Spinal part of right deltoid',
    'Upper Body',
    'BodyParts3D Concept: spinal part of right deltoid (FMA34684)',
    'FMA34684',
    'FMA34684',
    '["FJ1513"]'::jsonb,
    '[[-0.219171,1.2658612,-0.09727488000000001],[-0.08283410000000001,1.4179511999999999,-0.020747]]'::jsonb,
    'muscular',
    'spinal part of right deltoid',
    '{"conceptId":"FMA34684","elements":["FJ1513"],"system":"muscular","bounds":[[-0.219171,1.2658612,-0.09727488000000001],[-0.08283410000000001,1.4179511999999999,-0.020747]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Spinal part of left deltoid',
    'Upper Body',
    'BodyParts3D Concept: spinal part of left deltoid (FMA34685)',
    'FMA34685',
    'FMA34685',
    '["FJ1513M"]'::jsonb,
    '[[0.08283410000000001,1.2658612,-0.09727488000000001],[0.219171,1.4179511999999999,-0.020747]]'::jsonb,
    'muscular',
    'spinal part of left deltoid',
    '{"conceptId":"FMA34685","elements":["FJ1513M"],"system":"muscular","bounds":[[0.08283410000000001,1.2658612,-0.09727488000000001],[0.219171,1.4179511999999999,-0.020747]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Superficial head of right flexor pollicis brevis',
    'Upper Body',
    'BodyParts3D Concept: superficial head of right flexor pollicis brevis (FMA65198)',
    'FMA65198',
    'FMA65198',
    '["FJ1514"]'::jsonb,
    '[[-0.301995,0.8449902000000001,0.036637],[-0.25978300000000004,0.8749242,0.054202]]'::jsonb,
    'muscular',
    'superficial head of right flexor pollicis brevis',
    '{"conceptId":"FMA65198","elements":["FJ1514"],"system":"muscular","bounds":[[-0.301995,0.8449902000000001,0.036637],[-0.25978300000000004,0.8749242,0.054202]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Superficial head of left flexor pollicis brevis',
    'Upper Body',
    'BodyParts3D Concept: superficial head of left flexor pollicis brevis (FMA65199)',
    'FMA65199',
    'FMA65199',
    '["FJ1514M"]'::jsonb,
    '[[0.25978300000000004,0.8449902000000001,0.036637],[0.301995,0.8749242,0.054202]]'::jsonb,
    'muscular',
    'superficial head of left flexor pollicis brevis',
    '{"conceptId":"FMA65199","elements":["FJ1514M"],"system":"muscular","bounds":[[0.25978300000000004,0.8449902000000001,0.036637],[0.301995,0.8749242,0.054202]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Transverse head of right adductor pollicis',
    'Lower Body',
    'BodyParts3D Concept: transverse head of right adductor pollicis (FMA46123)',
    'FMA46123',
    'FMA46123',
    '["FJ1515"]'::jsonb,
    '[[-0.299765,0.8167452000000001,0.024207999999999993],[-0.258639,0.8548172,0.04672100000000001]]'::jsonb,
    'muscular',
    'transverse head of right adductor pollicis',
    '{"conceptId":"FMA46123","elements":["FJ1515"],"system":"muscular","bounds":[[-0.299765,0.8167452000000001,0.024207999999999993],[-0.258639,0.8548172,0.04672100000000001]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Transverse head of left adductor pollicis',
    'Lower Body',
    'BodyParts3D Concept: transverse head of left adductor pollicis (FMA46124)',
    'FMA46124',
    'FMA46124',
    '["FJ1515M"]'::jsonb,
    '[[0.258639,0.8167452000000001,0.024207999999999993],[0.299765,0.8548172,0.04672100000000001]]'::jsonb,
    'muscular',
    'transverse head of left adductor pollicis',
    '{"conceptId":"FMA46124","elements":["FJ1515M"],"system":"muscular","bounds":[[0.258639,0.8167452000000001,0.024207999999999993],[0.299765,0.8548172,0.04672100000000001]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Ulnar head of right pronator teres',
    'Upper Body',
    'BodyParts3D Concept: ulnar head of right pronator teres (FMA38562)',
    'FMA38562',
    'FMA38562',
    '["FJ1516"]'::jsonb,
    '[[-0.25631400000000004,1.0058542000000001,-0.025940900000000003],[-0.204265,1.1015412,-0.0016176999999999997]]'::jsonb,
    'muscular',
    'ulnar head of right pronator teres',
    '{"conceptId":"FMA38562","elements":["FJ1516"],"system":"muscular","bounds":[[-0.25631400000000004,1.0058542000000001,-0.025940900000000003],[-0.204265,1.1015412,-0.0016176999999999997]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Ulnar head of left pronator teres',
    'Upper Body',
    'BodyParts3D Concept: ulnar head of left pronator teres (FMA38563)',
    'FMA38563',
    'FMA38563',
    '["FJ1516M"]'::jsonb,
    '[[0.204265,1.0058542000000001,-0.025940900000000003],[0.25631400000000004,1.1015412,-0.0016176999999999997]]'::jsonb,
    'muscular',
    'ulnar head of left pronator teres',
    '{"conceptId":"FMA38563","elements":["FJ1516M"],"system":"muscular","bounds":[[0.204265,1.0058542000000001,-0.025940900000000003],[0.25631400000000004,1.1015412,-0.0016176999999999997]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Ulnar head of right flexor carpi ulnaris',
    'Upper Body',
    'BodyParts3D Concept: ulnar head of right flexor carpi ulnaris (FMA38619)',
    'FMA38619',
    'FMA38619',
    '["FJ1518"]'::jsonb,
    '[[-0.22951400000000002,0.9085872,-0.05260190000000001],[-0.18938,1.1214711999999998,0.016201999999999994]]'::jsonb,
    'muscular',
    'ulnar head of right flexor carpi ulnaris',
    '{"conceptId":"FMA38619","elements":["FJ1518"],"system":"muscular","bounds":[[-0.22951400000000002,0.9085872,-0.05260190000000001],[-0.18938,1.1214711999999998,0.016201999999999994]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Ulnar head of left flexor carpi ulnaris',
    'Upper Body',
    'BodyParts3D Concept: ulnar head of left flexor carpi ulnaris (FMA38620)',
    'FMA38620',
    'FMA38620',
    '["FJ1518M"]'::jsonb,
    '[[0.18938,0.9085872,-0.05260190000000001],[0.22951400000000002,1.1214711999999998,0.016201999999999994]]'::jsonb,
    'muscular',
    'ulnar head of left flexor carpi ulnaris',
    '{"conceptId":"FMA38620","elements":["FJ1518M"],"system":"muscular","bounds":[[0.18938,0.9085872,-0.05260190000000001],[0.22951400000000002,1.1214711999999998,0.016201999999999994]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Ascending part of right trapezius',
    'Upper Body',
    'BodyParts3D Concept: ascending part of right trapezius (FMA33581)',
    'FMA33581',
    'FMA33581',
    '["FJ1520"]'::jsonb,
    '[[-0.14858600000000002,1.1321212,-0.12454670000000001],[0.0032543600000000004,1.4210812,-0.0530363]]'::jsonb,
    'muscular',
    'ascending part of right trapezius',
    '{"conceptId":"FMA33581","elements":["FJ1520"],"system":"muscular","bounds":[[-0.14858600000000002,1.1321212,-0.12454670000000001],[0.0032543600000000004,1.4210812,-0.0530363]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Ascending part of left trapezius',
    'Upper Body',
    'BodyParts3D Concept: ascending part of left trapezius (FMA33583)',
    'FMA33583',
    'FMA33583',
    '["FJ1520M"]'::jsonb,
    '[[-0.0032543600000000004,1.1321212,-0.12454660000000001],[0.14858600000000002,1.4210812,-0.0530363]]'::jsonb,
    'muscular',
    'ascending part of left trapezius',
    '{"conceptId":"FMA33583","elements":["FJ1520M"],"system":"muscular","bounds":[[-0.0032543600000000004,1.1321212,-0.12454660000000001],[0.14858600000000002,1.4210812,-0.0530363]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Descending part of right trapezius',
    'Upper Body',
    'BodyParts3D Concept: descending part of right trapezius (FMA33586)',
    'FMA33586',
    'FMA33586',
    '["FJ1521"]'::jsonb,
    '[[-0.13084,1.4187011999999999,-0.09238652],[0.0034884200000000003,1.5843512,0.0006599999999999939]]'::jsonb,
    'muscular',
    'descending part of right trapezius',
    '{"conceptId":"FMA33586","elements":["FJ1521"],"system":"muscular","bounds":[[-0.13084,1.4187011999999999,-0.09238652],[0.0034884200000000003,1.5843512,0.0006599999999999939]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Descending part of left trapezius',
    'Upper Body',
    'BodyParts3D Concept: descending part of left trapezius (FMA33587)',
    'FMA33587',
    'FMA33587',
    '["FJ1521M"]'::jsonb,
    '[[-0.0034884200000000003,1.4187011999999999,-0.09238652],[0.13084,1.5843512,0.0006599999999999939]]'::jsonb,
    'muscular',
    'descending part of left trapezius',
    '{"conceptId":"FMA33587","elements":["FJ1521M"],"system":"muscular","bounds":[[-0.0034884200000000003,1.4187011999999999,-0.09238652],[0.13084,1.5843512,0.0006599999999999939]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right lumbar rotator',
    'Core',
    'BodyParts3D Concept: right lumbar rotator (FMA23089)',
    'FMA23089',
    'FMA23089',
    '["FJ1522"]'::jsonb,
    '[[-0.038896900000000005,1.0138352000000002,-0.06759899999999999],[0.000745276,1.1786512,-0.027151600000000012]]'::jsonb,
    'muscular',
    'right lumbar rotator',
    '{"conceptId":"FMA23089","elements":["FJ1522"],"system":"muscular","bounds":[[-0.038896900000000005,1.0138352000000002,-0.06759899999999999],[0.000745276,1.1786512,-0.027151600000000012]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left lumbar rotator',
    'Core',
    'BodyParts3D Concept: left lumbar rotator (FMA23090)',
    'FMA23090',
    'FMA23090',
    '["FJ1522M"]'::jsonb,
    '[[-0.000745276,1.0138352000000002,-0.0675989],[0.038896900000000005,1.1786611999999999,-0.027151600000000012]]'::jsonb,
    'muscular',
    'left lumbar rotator',
    '{"conceptId":"FMA23090","elements":["FJ1522M"],"system":"muscular","bounds":[[-0.000745276,1.0138352000000002,-0.0675989],[0.038896900000000005,1.1786611999999999,-0.027151600000000012]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right cervical rotator',
    'Muscular System',
    'BodyParts3D Concept: right cervical rotator (FMA81752)',
    'FMA81752',
    'FMA81752',
    '["FJ1524"]'::jsonb,
    '[[-0.028517800000000003,1.4373612,-0.0570106],[0.000389317,1.5486512,-0.0329252]]'::jsonb,
    'muscular',
    'right cervical rotator',
    '{"conceptId":"FMA81752","elements":["FJ1524"],"system":"muscular","bounds":[[-0.028517800000000003,1.4373612,-0.0570106],[0.000389317,1.5486512,-0.0329252]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left cervical rotator',
    'Muscular System',
    'BodyParts3D Concept: left cervical rotator (FMA81753)',
    'FMA81753',
    'FMA81753',
    '["FJ1524M"]'::jsonb,
    '[[-0.000389317,1.4373612,-0.0570106],[0.028517800000000003,1.5486512,-0.0329252]]'::jsonb,
    'muscular',
    'left cervical rotator',
    '{"conceptId":"FMA81753","elements":["FJ1524M"],"system":"muscular","bounds":[[-0.000389317,1.4373612,-0.0570106],[0.028517800000000003,1.5486512,-0.0329252]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Thoracic rotator',
    'Muscular System',
    'BodyParts3D Concept: thoracic rotator (FMA23083)',
    'FMA23083',
    'FMA23083',
    '["FJ1525","FJ1525M"]'::jsonb,
    '[[-0.0300671,1.1574012,-0.08761580000000001],[0.00148423,1.4568611999999999,-0.0405604]]'::jsonb,
    'muscular',
    'thoracic rotator',
    '{"conceptId":"FMA23083","elements":["FJ1525","FJ1525M"],"system":"muscular","bounds":[[-0.0300671,1.1574012,-0.08761580000000001],[0.00148423,1.4568611999999999,-0.0405604]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right iliocostalis cervicis',
    'Muscular System',
    'BodyParts3D Concept: right iliocostalis cervicis (FMA22744)',
    'FMA22744',
    'FMA22744',
    '["FJ1526"]'::jsonb,
    '[[-0.073506,1.3178812,-0.09401445],[-0.0223597,1.4978212,-0.01911660000000001]]'::jsonb,
    'muscular',
    'right iliocostalis cervicis',
    '{"conceptId":"FMA22744","elements":["FJ1526"],"system":"muscular","bounds":[[-0.073506,1.3178812,-0.09401445],[-0.0223597,1.4978212,-0.01911660000000001]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left iliocostalis cervicis',
    'Muscular System',
    'BodyParts3D Concept: left iliocostalis cervicis (FMA22745)',
    'FMA22745',
    'FMA22745',
    '["FJ1526M"]'::jsonb,
    '[[0.0223597,1.3178812,-0.09401445],[0.073506,1.4978212,-0.01911660000000001]]'::jsonb,
    'muscular',
    'left iliocostalis cervicis',
    '{"conceptId":"FMA22745","elements":["FJ1526M"],"system":"muscular","bounds":[[0.0223597,1.3178812,-0.09401445],[0.073506,1.4978212,-0.01911660000000001]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right iliocostalis lumborum',
    'Muscular System',
    'BodyParts3D Concept: right iliocostalis lumborum (FMA22740)',
    'FMA22740',
    'FMA22740',
    '["FJ1527"]'::jsonb,
    '[[-0.102321,0.9081722000000001,-0.10915195],[-0.00507706,1.3170112,-0.0644323]]'::jsonb,
    'muscular',
    'right iliocostalis lumborum',
    '{"conceptId":"FMA22740","elements":["FJ1527"],"system":"muscular","bounds":[[-0.102321,0.9081722000000001,-0.10915195],[-0.00507706,1.3170112,-0.0644323]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left iliocostalis lumborum',
    'Muscular System',
    'BodyParts3D Concept: left iliocostalis lumborum (FMA22741)',
    'FMA22741',
    'FMA22741',
    '["FJ1527M"]'::jsonb,
    '[[0.00507706,0.9081722000000001,-0.10915195],[0.102321,1.3170112,-0.0644323]]'::jsonb,
    'muscular',
    'left iliocostalis lumborum',
    '{"conceptId":"FMA22741","elements":["FJ1527M"],"system":"muscular","bounds":[[0.00507706,0.9081722000000001,-0.10915195],[0.102321,1.3170112,-0.0644323]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right iliocostalis thoracis',
    'Muscular System',
    'BodyParts3D Concept: right iliocostalis thoracis (FMA22742)',
    'FMA22742',
    'FMA22742',
    '["FJ1528"]'::jsonb,
    '[[-0.092016,1.1347311999999998,-0.10069636500000001],[-0.041852200000000006,1.4391212,-0.02463670000000001]]'::jsonb,
    'muscular',
    'right iliocostalis thoracis',
    '{"conceptId":"FMA22742","elements":["FJ1528"],"system":"muscular","bounds":[[-0.092016,1.1347311999999998,-0.10069636500000001],[-0.041852200000000006,1.4391212,-0.02463670000000001]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left iliocostalis thoracis',
    'Muscular System',
    'BodyParts3D Concept: left iliocostalis thoracis (FMA22743)',
    'FMA22743',
    'FMA22743',
    '["FJ1528M"]'::jsonb,
    '[[0.041852200000000006,1.1347311999999998,-0.10069636500000001],[0.092016,1.4391212,-0.02463670000000001]]'::jsonb,
    'muscular',
    'left iliocostalis thoracis',
    '{"conceptId":"FMA22743","elements":["FJ1528M"],"system":"muscular","bounds":[[0.041852200000000006,1.1347311999999998,-0.10069636500000001],[0.092016,1.4391212,-0.02463670000000001]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right longissimus capitis',
    'Muscular System',
    'BodyParts3D Concept: right longissimus capitis (FMA22754)',
    'FMA22754',
    'FMA22754',
    '["FJ1533"]'::jsonb,
    '[[-0.060498199999999995,1.4127512,-0.06484870000000001],[-0.0240834,1.5780112000000002,-0.021029400000000004]]'::jsonb,
    'muscular',
    'right longissimus capitis',
    '{"conceptId":"FMA22754","elements":["FJ1533"],"system":"muscular","bounds":[[-0.060498199999999995,1.4127512,-0.06484870000000001],[-0.0240834,1.5780112000000002,-0.021029400000000004]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left longissimus capitis',
    'Muscular System',
    'BodyParts3D Concept: left longissimus capitis (FMA22756)',
    'FMA22756',
    'FMA22756',
    '["FJ1533M"]'::jsonb,
    '[[0.0240834,1.4127512,-0.06484870000000001],[0.060498199999999995,1.5780112000000002,-0.021029400000000004]]'::jsonb,
    'muscular',
    'left longissimus capitis',
    '{"conceptId":"FMA22756","elements":["FJ1533M"],"system":"muscular","bounds":[[0.0240834,1.4127512,-0.06484870000000001],[0.060498199999999995,1.5780112000000002,-0.021029400000000004]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right longissimus cervicis',
    'Muscular System',
    'BodyParts3D Concept: right longissimus cervicis (FMA22757)',
    'FMA22757',
    'FMA22757',
    '["FJ1534"]'::jsonb,
    '[[-0.0397896,1.3299811999999998,-0.0869],[-0.019884000000000002,1.5257311999999998,-0.020275700000000008]]'::jsonb,
    'muscular',
    'right longissimus cervicis',
    '{"conceptId":"FMA22757","elements":["FJ1534"],"system":"muscular","bounds":[[-0.0397896,1.3299811999999998,-0.0869],[-0.019884000000000002,1.5257311999999998,-0.020275700000000008]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left longissimus cervicis',
    'Muscular System',
    'BodyParts3D Concept: left longissimus cervicis (FMA22758)',
    'FMA22758',
    'FMA22758',
    '["FJ1534M"]'::jsonb,
    '[[0.019884000000000002,1.3299811999999998,-0.0869],[0.0397896,1.5257311999999998,-0.020275700000000008]]'::jsonb,
    'muscular',
    'left longissimus cervicis',
    '{"conceptId":"FMA22758","elements":["FJ1534M"],"system":"muscular","bounds":[[0.019884000000000002,1.3299811999999998,-0.0869],[0.0397896,1.5257311999999998,-0.020275700000000008]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right longissimus thoracis',
    'Muscular System',
    'BodyParts3D Concept: right longissimus thoracis (FMA22751)',
    'FMA22751',
    'FMA22751',
    '["FJ1535"]'::jsonb,
    '[[-0.0687416,0.9271502,-0.10345524],[0.000663053,1.4485212,-0.029343599999999997]]'::jsonb,
    'muscular',
    'right longissimus thoracis',
    '{"conceptId":"FMA22751","elements":["FJ1535"],"system":"muscular","bounds":[[-0.0687416,0.9271502,-0.10345524],[0.000663053,1.4485212,-0.029343599999999997]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left longissimus thoracis',
    'Muscular System',
    'BodyParts3D Concept: left longissimus thoracis (FMA22753)',
    'FMA22753',
    'FMA22753',
    '["FJ1535M"]'::jsonb,
    '[[-0.000663053,0.9271502,-0.10345524],[0.0687416,1.4485212,-0.029343599999999997]]'::jsonb,
    'muscular',
    'left longissimus thoracis',
    '{"conceptId":"FMA22753","elements":["FJ1535M"],"system":"muscular","bounds":[[-0.000663053,0.9271502,-0.10345524],[0.0687416,1.4485212,-0.029343599999999997]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right rhomboid major',
    'Upper Body',
    'BodyParts3D Concept: right rhomboid major (FMA13381)',
    'FMA13381',
    'FMA13381',
    '["FJ1536"]'::jsonb,
    '[[-0.0895036,1.2663012,-0.10609221],[0.0007767570000000001,1.4397712,-0.07790190000000001]]'::jsonb,
    'muscular',
    'right rhomboid major',
    '{"conceptId":"FMA13381","elements":["FJ1536"],"system":"muscular","bounds":[[-0.0895036,1.2663012,-0.10609221],[0.0007767570000000001,1.4397712,-0.07790190000000001]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left rhomboid major',
    'Upper Body',
    'BodyParts3D Concept: left rhomboid major (FMA13382)',
    'FMA13382',
    'FMA13382',
    '["FJ1536M"]'::jsonb,
    '[[-0.0007767570000000001,1.2663012,-0.10609221],[0.0895036,1.4397712,-0.07790190000000001]]'::jsonb,
    'muscular',
    'left rhomboid major',
    '{"conceptId":"FMA13382","elements":["FJ1536M"],"system":"muscular","bounds":[[-0.0007767570000000001,1.2663012,-0.10609221],[0.0895036,1.4397712,-0.07790190000000001]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right rhomboid minor',
    'Upper Body',
    'BodyParts3D Concept: right rhomboid minor (FMA13383)',
    'FMA13383',
    'FMA13383',
    '["FJ1537"]'::jsonb,
    '[[-0.0617054,1.3589111999999999,-0.09518398],[0.0009160500000000001,1.4656212,-0.0639236]]'::jsonb,
    'muscular',
    'right rhomboid minor',
    '{"conceptId":"FMA13383","elements":["FJ1537"],"system":"muscular","bounds":[[-0.0617054,1.3589111999999999,-0.09518398],[0.0009160500000000001,1.4656212,-0.0639236]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left rhomboid minor',
    'Upper Body',
    'BodyParts3D Concept: left rhomboid minor (FMA13384)',
    'FMA13384',
    'FMA13384',
    '["FJ1537M"]'::jsonb,
    '[[-0.0009160500000000001,1.3589111999999999,-0.09518398],[0.0617054,1.4656212,-0.0639236]]'::jsonb,
    'muscular',
    'left rhomboid minor',
    '{"conceptId":"FMA13384","elements":["FJ1537M"],"system":"muscular","bounds":[[-0.0009160500000000001,1.3589111999999999,-0.09518398],[0.0617054,1.4656212,-0.0639236]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right semispinalis capitis',
    'Muscular System',
    'BodyParts3D Concept: right semispinalis capitis (FMA22876)',
    'FMA22876',
    'FMA22876',
    '["FJ1538"]'::jsonb,
    '[[-0.0435047,1.4533312,-0.0853932],[-0.00334219,1.5727812,-0.031226900000000002]]'::jsonb,
    'muscular',
    'right semispinalis capitis',
    '{"conceptId":"FMA22876","elements":["FJ1538"],"system":"muscular","bounds":[[-0.0435047,1.4533312,-0.0853932],[-0.00334219,1.5727812,-0.031226900000000002]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left semispinalis capitis',
    'Muscular System',
    'BodyParts3D Concept: left semispinalis capitis (FMA22877)',
    'FMA22877',
    'FMA22877',
    '["FJ1538M"]'::jsonb,
    '[[0.00334219,1.4533312,-0.0853932],[0.0435047,1.5727812,-0.031226900000000002]]'::jsonb,
    'muscular',
    'left semispinalis capitis',
    '{"conceptId":"FMA22877","elements":["FJ1538M"],"system":"muscular","bounds":[[0.00334219,1.4533312,-0.0853932],[0.0435047,1.5727812,-0.031226900000000002]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right semispinalis cervicis',
    'Muscular System',
    'BodyParts3D Concept: right semispinalis cervicis (FMA22874)',
    'FMA22874',
    'FMA22874',
    '["FJ1539"]'::jsonb,
    '[[-0.0296575,1.3594111999999998,-0.08138690000000001],[0.000922392,1.5080112,-0.035442]]'::jsonb,
    'muscular',
    'right semispinalis cervicis',
    '{"conceptId":"FMA22874","elements":["FJ1539"],"system":"muscular","bounds":[[-0.0296575,1.3594111999999998,-0.08138690000000001],[0.000922392,1.5080112,-0.035442]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left semispinalis cervicis',
    'Muscular System',
    'BodyParts3D Concept: left semispinalis cervicis (FMA22875)',
    'FMA22875',
    'FMA22875',
    '["FJ1539M"]'::jsonb,
    '[[-0.000922392,1.3594111999999998,-0.08138690000000001],[0.0296575,1.5080112,-0.035442]]'::jsonb,
    'muscular',
    'left semispinalis cervicis',
    '{"conceptId":"FMA22875","elements":["FJ1539M"],"system":"muscular","bounds":[[-0.000922392,1.3594111999999998,-0.08138690000000001],[0.0296575,1.5080112,-0.035442]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right semispinalis thoracis',
    'Muscular System',
    'BodyParts3D Concept: right semispinalis thoracis (FMA22872)',
    'FMA22872',
    'FMA22872',
    '["FJ1540"]'::jsonb,
    '[[-0.032909799999999996,1.1601811999999998,-0.09779134],[0.00100132,1.4363012,-0.0555943]]'::jsonb,
    'muscular',
    'right semispinalis thoracis',
    '{"conceptId":"FMA22872","elements":["FJ1540"],"system":"muscular","bounds":[[-0.032909799999999996,1.1601811999999998,-0.09779134],[0.00100132,1.4363012,-0.0555943]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left semispinalis thoracis',
    'Muscular System',
    'BodyParts3D Concept: left semispinalis thoracis (FMA22873)',
    'FMA22873',
    'FMA22873',
    '["FJ1540M"]'::jsonb,
    '[[-0.00100132,1.1601811999999998,-0.09779134],[0.032909799999999996,1.4363012,-0.0555943]]'::jsonb,
    'muscular',
    'left semispinalis thoracis',
    '{"conceptId":"FMA22873","elements":["FJ1540M"],"system":"muscular","bounds":[[-0.00100132,1.1601811999999998,-0.09779134],[0.032909799999999996,1.4363012,-0.0555943]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right serratus posterior inferior',
    'Upper Body',
    'BodyParts3D Concept: right serratus posterior inferior (FMA13405)',
    'FMA13405',
    'FMA13405',
    '["FJ1541"]'::jsonb,
    '[[-0.106242,1.0476262,-0.09871903],[0.00245107,1.2101312,-0.05768430000000001]]'::jsonb,
    'muscular',
    'right serratus posterior inferior',
    '{"conceptId":"FMA13405","elements":["FJ1541"],"system":"muscular","bounds":[[-0.106242,1.0476262,-0.09871903],[0.00245107,1.2101312,-0.05768430000000001]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left serratus posterior inferior',
    'Upper Body',
    'BodyParts3D Concept: left serratus posterior inferior (FMA13406)',
    'FMA13406',
    'FMA13406',
    '["FJ1541M"]'::jsonb,
    '[[-0.00245107,1.0476262,-0.09871902],[0.106243,1.2101312,-0.05768430000000001]]'::jsonb,
    'muscular',
    'left serratus posterior inferior',
    '{"conceptId":"FMA13406","elements":["FJ1541M"],"system":"muscular","bounds":[[-0.00245107,1.0476262,-0.09871902],[0.106243,1.2101312,-0.05768430000000001]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right serratus posterior superior',
    'Upper Body',
    'BodyParts3D Concept: right serratus posterior superior (FMA13403)',
    'FMA13403',
    'FMA13403',
    '["FJ1542"]'::jsonb,
    '[[-0.10314100000000001,1.3324812,-0.09101060000000001],[0.000703727,1.4636012,-0.026308700000000004]]'::jsonb,
    'muscular',
    'right serratus posterior superior',
    '{"conceptId":"FMA13403","elements":["FJ1542"],"system":"muscular","bounds":[[-0.10314100000000001,1.3324812,-0.09101060000000001],[0.000703727,1.4636012,-0.026308700000000004]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left serratus posterior superior',
    'Upper Body',
    'BodyParts3D Concept: left serratus posterior superior (FMA13404)',
    'FMA13404',
    'FMA13404',
    '["FJ1542M"]'::jsonb,
    '[[-0.000703727,1.3324812,-0.09101060000000001],[0.10314100000000001,1.4636012,-0.026308700000000004]]'::jsonb,
    'muscular',
    'left serratus posterior superior',
    '{"conceptId":"FMA13404","elements":["FJ1542M"],"system":"muscular","bounds":[[-0.000703727,1.3324812,-0.09101060000000001],[0.10314100000000001,1.4636012,-0.026308700000000004]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Spinalis',
    'Muscular System',
    'BodyParts3D Concept: spinalis (FMA77179)',
    'FMA77179',
    'FMA77179',
    '["FJ1543","FJ1543M","FJ1544","FJ1544M"]'::jsonb,
    '[[-0.0079614,1.4073212,-0.0877463],[-0.0000773067,1.5135312,-0.05654750000000001]]'::jsonb,
    'muscular',
    'spinalis',
    '{"conceptId":"FMA77179","elements":["FJ1543","FJ1543M","FJ1544","FJ1544M"],"system":"muscular","bounds":[[-0.0079614,1.4073212,-0.0877463],[-0.0000773067,1.5135312,-0.05654750000000001]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right spinalis thoracis',
    'Muscular System',
    'BodyParts3D Concept: right spinalis thoracis (FMA22779)',
    'FMA22779',
    'FMA22779',
    '["FJ1544"]'::jsonb,
    '[[-0.012049899999999999,1.0523502,-0.10280701],[0.00230392,1.4129112,-0.056101200000000004]]'::jsonb,
    'muscular',
    'right spinalis thoracis',
    '{"conceptId":"FMA22779","elements":["FJ1544"],"system":"muscular","bounds":[[-0.012049899999999999,1.0523502,-0.10280701],[0.00230392,1.4129112,-0.056101200000000004]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left spinalis thoracis',
    'Muscular System',
    'BodyParts3D Concept: left spinalis thoracis (FMA22780)',
    'FMA22780',
    'FMA22780',
    '["FJ1544M"]'::jsonb,
    '[[-0.00230392,1.0523502,-0.10280701],[0.012049899999999999,1.4129112,-0.056101200000000004]]'::jsonb,
    'muscular',
    'left spinalis thoracis',
    '{"conceptId":"FMA22780","elements":["FJ1544M"],"system":"muscular","bounds":[[-0.00230392,1.0523502,-0.10280701],[0.012049899999999999,1.4129112,-0.056101200000000004]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right splenius capitis',
    'Head & Neck',
    'BodyParts3D Concept: right splenius capitis (FMA22728)',
    'FMA22728',
    'FMA22728',
    '["FJ1545"]'::jsonb,
    '[[-0.0608389,1.3634612,-0.10206777],[0.0025878299999999997,1.5771612,-0.027983400000000005]]'::jsonb,
    'muscular',
    'right splenius capitis',
    '{"conceptId":"FMA22728","elements":["FJ1545"],"system":"muscular","bounds":[[-0.0608389,1.3634612,-0.10206777],[0.0025878299999999997,1.5771612,-0.027983400000000005]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left splenius capitis',
    'Head & Neck',
    'BodyParts3D Concept: left splenius capitis (FMA22729)',
    'FMA22729',
    'FMA22729',
    '["FJ1545M"]'::jsonb,
    '[[-0.0025878299999999997,1.3634612,-0.10206778000000001],[0.0608389,1.5771612,-0.027983300000000003]]'::jsonb,
    'muscular',
    'left splenius capitis',
    '{"conceptId":"FMA22729","elements":["FJ1545M"],"system":"muscular","bounds":[[-0.0025878299999999997,1.3634612,-0.10206778000000001],[0.0608389,1.5771612,-0.027983300000000003]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right splenius cervicis',
    'Head & Neck',
    'BodyParts3D Concept: right splenius cervicis (FMA22726)',
    'FMA22726',
    'FMA22726',
    '["FJ1546"]'::jsonb,
    '[[-0.041196199999999995,1.2953012,-0.10480826],[0.0015863799999999999,1.5495012000000001,-0.0228304]]'::jsonb,
    'muscular',
    'right splenius cervicis',
    '{"conceptId":"FMA22726","elements":["FJ1546"],"system":"muscular","bounds":[[-0.041196199999999995,1.2953012,-0.10480826],[0.0015863799999999999,1.5495012000000001,-0.0228304]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left splenius cervicis',
    'Head & Neck',
    'BodyParts3D Concept: left splenius cervicis (FMA22727)',
    'FMA22727',
    'FMA22727',
    '["FJ1546M"]'::jsonb,
    '[[-0.0015863799999999999,1.2953012,-0.10480826],[0.041196199999999995,1.5495012000000001,-0.0228304]]'::jsonb,
    'muscular',
    'left splenius cervicis',
    '{"conceptId":"FMA22727","elements":["FJ1546M"],"system":"muscular","bounds":[[-0.0015863799999999999,1.2953012,-0.10480826],[0.041196199999999995,1.5495012000000001,-0.0228304]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Lateral lumbar intertransversarius',
    'Core',
    'BodyParts3D Concept: lateral lumbar intertransversarius (FMA22850)',
    'FMA22850',
    'FMA22850',
    '["FJ1547","FJ1547M"]'::jsonb,
    '[[-0.0468852,1.0201422,-0.0589417],[-0.0187261,1.1666712,-0.029115100000000005]]'::jsonb,
    'muscular',
    'lateral lumbar intertransversarius',
    '{"conceptId":"FMA22850","elements":["FJ1547","FJ1547M"],"system":"muscular","bounds":[[-0.0468852,1.0201422,-0.0589417],[-0.0187261,1.1666712,-0.029115100000000005]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Medial lumbar intertransversarius',
    'Core',
    'BodyParts3D Concept: medial lumbar intertransversarius (FMA22851)',
    'FMA22851',
    'FMA22851',
    '["FJ1548","FJ1548M"]'::jsonb,
    '[[-0.0463993,1.0168492,-0.0429008],[-0.020975200000000003,1.1293912,-0.027119000000000004]]'::jsonb,
    'muscular',
    'medial lumbar intertransversarius',
    '{"conceptId":"FMA22851","elements":["FJ1548","FJ1548M"],"system":"muscular","bounds":[[-0.0463993,1.0168492,-0.0429008],[-0.020975200000000003,1.1293912,-0.027119000000000004]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Set of anterior cervical intertransversarii',
    'Muscular System',
    'BodyParts3D Concept: set of anterior cervical intertransversarii (FMA71442)',
    'FMA71442',
    'FMA71442',
    '["FJ1549","FJ1549M"]'::jsonb,
    '[[-0.0376019,1.4533411999999999,-0.027013800000000004],[-0.015501,1.5493212,-0.013938000000000006]]'::jsonb,
    'muscular',
    'set of anterior cervical intertransversarii',
    '{"conceptId":"FMA71442","elements":["FJ1549","FJ1549M"],"system":"muscular","bounds":[[-0.0376019,1.4533411999999999,-0.027013800000000004],[-0.015501,1.5493212,-0.013938000000000006]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Set of interspinales lumborum',
    'Muscular System',
    'BodyParts3D Concept: set of interspinales lumborum (FMA71307)',
    'FMA71307',
    'FMA71307',
    '["FJ1550","FJ1550M"]'::jsonb,
    '[[-0.00458165,1.0130552,-0.06719080000000001],[0.00113927,1.1044512,-0.0574145]]'::jsonb,
    'muscular',
    'set of interspinales lumborum',
    '{"conceptId":"FMA71307","elements":["FJ1550","FJ1550M"],"system":"muscular","bounds":[[-0.00458165,1.0130552,-0.06719080000000001],[0.00113927,1.1044512,-0.0574145]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right interspinalis thoracis',
    'Muscular System',
    'BodyParts3D Concept: right interspinalis thoracis (FMA22890)',
    'FMA22890',
    'FMA22890',
    '["FJ1551"]'::jsonb,
    '[[-0.0063955,1.3846711999999999,-0.09432001000000001],[0.00038532100000000005,1.4282111999999998,-0.07694300000000001]]'::jsonb,
    'muscular',
    'right interspinalis thoracis',
    '{"conceptId":"FMA22890","elements":["FJ1551"],"system":"muscular","bounds":[[-0.0063955,1.3846711999999999,-0.09432001000000001],[0.00038532100000000005,1.4282111999999998,-0.07694300000000001]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left interspinalis thoracis',
    'Muscular System',
    'BodyParts3D Concept: left interspinalis thoracis (FMA22891)',
    'FMA22891',
    'FMA22891',
    '["FJ1551M"]'::jsonb,
    '[[-0.00038532100000000005,1.3846711999999999,-0.09432001000000001],[0.0063955,1.4282111999999998,-0.07694300000000001]]'::jsonb,
    'muscular',
    'left interspinalis thoracis',
    '{"conceptId":"FMA22891","elements":["FJ1551M"],"system":"muscular","bounds":[[-0.00038532100000000005,1.3846711999999999,-0.09432001000000001],[0.0063955,1.4282111999999998,-0.07694300000000001]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Set of interspinales cervicis',
    'Muscular System',
    'BodyParts3D Concept: set of interspinales cervicis (FMA71309)',
    'FMA71309',
    'FMA71309',
    '["FJ1552","FJ1552M"]'::jsonb,
    '[[-0.00711682,1.4510512,-0.07171290000000001],[0.000686548,1.5450012,-0.0522149]]'::jsonb,
    'muscular',
    'set of interspinales cervicis',
    '{"conceptId":"FMA71309","elements":["FJ1552","FJ1552M"],"system":"muscular","bounds":[[-0.00711682,1.4510512,-0.07171290000000001],[0.000686548,1.5450012,-0.0522149]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Set of posterior cervical intertransversarii',
    'Muscular System',
    'BodyParts3D Concept: set of posterior cervical intertransversarii (FMA71443)',
    'FMA71443',
    'FMA71443',
    '["FJ1553","FJ1553M"]'::jsonb,
    '[[-0.039728700000000006,1.4597712,-0.03173480000000001],[-0.0214056,1.5464212,-0.0203415]]'::jsonb,
    'muscular',
    'set of posterior cervical intertransversarii',
    '{"conceptId":"FMA71443","elements":["FJ1553","FJ1553M"],"system":"muscular","bounds":[[-0.039728700000000006,1.4597712,-0.03173480000000001],[-0.0214056,1.5464212,-0.0203415]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Transverse part of right trapezius',
    'Upper Body',
    'BodyParts3D Concept: transverse part of right trapezius (FMA33584)',
    'FMA33584',
    'FMA33584',
    '["FJ1554"]'::jsonb,
    '[[-0.163242,1.3817312,-0.1107009],[0.00387271,1.4602211999999999,-0.030346100000000015]]'::jsonb,
    'muscular',
    'transverse part of right trapezius',
    '{"conceptId":"FMA33584","elements":["FJ1554"],"system":"muscular","bounds":[[-0.163242,1.3817312,-0.1107009],[0.00387271,1.4602211999999999,-0.030346100000000015]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Transverse part of left trapezius',
    'Upper Body',
    'BodyParts3D Concept: transverse part of left trapezius (FMA33585)',
    'FMA33585',
    'FMA33585',
    '["FJ1554M"]'::jsonb,
    '[[-0.00387271,1.3817412,-0.1107009],[0.163242,1.4602211999999999,-0.030346100000000015]]'::jsonb,
    'muscular',
    'transverse part of left trapezius',
    '{"conceptId":"FMA33585","elements":["FJ1554M"],"system":"muscular","bounds":[[-0.00387271,1.3817412,-0.1107009],[0.163242,1.4602211999999999,-0.030346100000000015]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left digastric',
    'Muscular System',
    'BodyParts3D Concept: left digastric (FMA46293)',
    'FMA46293',
    'FMA46293',
    '["FJ1555","FJ1560","FJ1578"]'::jsonb,
    '[[0.00253369,1.5073512,0.023876999999999995],[0.0123631,1.5120612,0.058454000000000006]]'::jsonb,
    'muscular',
    'left digastric',
    '{"conceptId":"FMA46293","elements":["FJ1555","FJ1560","FJ1578"],"system":"muscular","bounds":[[0.00253369,1.5073512,0.023876999999999995],[0.0123631,1.5120612,0.058454000000000006]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right digastric',
    'Muscular System',
    'BodyParts3D Concept: right digastric (FMA46292)',
    'FMA46292',
    'FMA46292',
    '["FJ1556","FJ1579"]'::jsonb,
    '[[-0.015276099999999999,1.5079411999999999,0.023992],[-0.00383204,1.5140712,0.058504]]'::jsonb,
    'muscular',
    'right digastric',
    '{"conceptId":"FMA46292","elements":["FJ1556","FJ1579"],"system":"muscular","bounds":[[-0.015276099999999999,1.5079411999999999,0.023992],[-0.00383204,1.5140712,0.058504]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Inferior oblique part of left longus colli',
    'Core',
    'BodyParts3D Concept: inferior oblique part of left longus colli (FMA46288)',
    'FMA46288',
    'FMA46288',
    '["FJ1557"]'::jsonb,
    '[[0.00220439,1.3898911999999999,-0.030783199999999997],[0.0236495,1.4694812,-0.009839500000000001]]'::jsonb,
    'muscular',
    'inferior oblique part of left longus colli',
    '{"conceptId":"FMA46288","elements":["FJ1557"],"system":"muscular","bounds":[[0.00220439,1.3898911999999999,-0.030783199999999997],[0.0236495,1.4694812,-0.009839500000000001]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left platysma',
    'Muscular System',
    'BodyParts3D Concept: left platysma (FMA45740)',
    'FMA45740',
    'FMA45740',
    '["FJ1558"]'::jsonb,
    '[[-0.00037663700000000003,1.3974811999999999,-0.050201600000000006],[0.145761,1.5462912,0.073513]]'::jsonb,
    'muscular',
    'left platysma',
    '{"conceptId":"FMA45740","elements":["FJ1558"],"system":"muscular","bounds":[[-0.00037663700000000003,1.3974811999999999,-0.050201600000000006],[0.145761,1.5462912,0.073513]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left geniohyoid',
    'Head & Neck',
    'BodyParts3D Concept: left geniohyoid (FMA46327)',
    'FMA46327',
    'FMA46327',
    '["FJ1559"]'::jsonb,
    '[[-0.000548999,1.5011712,0.020962999999999996],[0.00702057,1.5149912,0.060247999999999996]]'::jsonb,
    'muscular',
    'left geniohyoid',
    '{"conceptId":"FMA46327","elements":["FJ1559"],"system":"muscular","bounds":[[-0.000548999,1.5011712,0.020962999999999996],[0.00702057,1.5149912,0.060247999999999996]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left longus capitis',
    'Muscular System',
    'BodyParts3D Concept: left longus capitis (FMA46310)',
    'FMA46310',
    'FMA46310',
    '["FJ1561"]'::jsonb,
    '[[0.00103732,1.4638112,-0.022670800000000005],[0.025480899999999997,1.5747512000000001,-0.004951400000000009]]'::jsonb,
    'muscular',
    'left longus capitis',
    '{"conceptId":"FMA46310","elements":["FJ1561"],"system":"muscular","bounds":[[0.00103732,1.4638112,-0.022670800000000005],[0.025480899999999997,1.5747512000000001,-0.004951400000000009]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left mylohyoid',
    'Head & Neck',
    'BodyParts3D Concept: left mylohyoid (FMA46322)',
    'FMA46322',
    'FMA46322',
    '["FJ1562"]'::jsonb,
    '[[-0.000655269,1.5097311999999998,0.022194999999999993],[0.025460899999999998,1.5339912,0.058807]]'::jsonb,
    'muscular',
    'left mylohyoid',
    '{"conceptId":"FMA46322","elements":["FJ1562"],"system":"muscular","bounds":[[-0.000655269,1.5097311999999998,0.022194999999999993],[0.025460899999999998,1.5339912,0.058807]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left obliquus capitis inferior',
    'Muscular System',
    'BodyParts3D Concept: left obliquus capitis inferior (FMA32537)',
    'FMA32537',
    'FMA32537',
    '["FJ1563"]'::jsonb,
    '[[0.000606783,1.5140212,-0.0623809],[0.0425704,1.5469711999999998,-0.026800900000000002]]'::jsonb,
    'muscular',
    'left obliquus capitis inferior',
    '{"conceptId":"FMA32537","elements":["FJ1563"],"system":"muscular","bounds":[[0.000606783,1.5140212,-0.0623809],[0.0425704,1.5469711999999998,-0.026800900000000002]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left obliquus capitis superior',
    'Muscular System',
    'BodyParts3D Concept: left obliquus capitis superior (FMA32535)',
    'FMA32535',
    'FMA32535',
    '["FJ1564"]'::jsonb,
    '[[0.0290698,1.5451112,-0.0795132],[0.042790999999999996,1.5697012,-0.029189700000000013]]'::jsonb,
    'muscular',
    'left obliquus capitis superior',
    '{"conceptId":"FMA32535","elements":["FJ1564"],"system":"muscular","bounds":[[0.0290698,1.5451112,-0.0795132],[0.042790999999999996,1.5697012,-0.029189700000000013]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left omohyoid',
    'Head & Neck',
    'BodyParts3D Concept: left omohyoid (FMA13349)',
    'FMA13349',
    'FMA13349',
    '["FJ1565"]'::jsonb,
    '[[0.0113209,1.3959811999999998,-0.07354830000000001],[0.10451,1.5053412,0.022259]]'::jsonb,
    'muscular',
    'left omohyoid',
    '{"conceptId":"FMA13349","elements":["FJ1565"],"system":"muscular","bounds":[[0.0113209,1.3959811999999998,-0.07354830000000001],[0.10451,1.5053412,0.022259]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left rectus capitis anterior',
    'Head & Neck',
    'BodyParts3D Concept: left rectus capitis anterior (FMA46314)',
    'FMA46314',
    'FMA46314',
    '["FJ1566"]'::jsonb,
    '[[0.0020251600000000002,1.5497712000000001,-0.0226007],[0.0276865,1.5713812,-0.012304700000000002]]'::jsonb,
    'muscular',
    'left rectus capitis anterior',
    '{"conceptId":"FMA46314","elements":["FJ1566"],"system":"muscular","bounds":[[0.0020251600000000002,1.5497712000000001,-0.0226007],[0.0276865,1.5713812,-0.012304700000000002]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left rectus capitis posterior major',
    'Head & Neck',
    'BodyParts3D Concept: left rectus capitis posterior major (FMA32531)',
    'FMA32531',
    'FMA32531',
    '["FJ1567"]'::jsonb,
    '[[0.00018306300000000002,1.5187111999999998,-0.0754269],[0.0363961,1.5666711999999998,-0.049544700000000004]]'::jsonb,
    'muscular',
    'left rectus capitis posterior major',
    '{"conceptId":"FMA32531","elements":["FJ1567"],"system":"muscular","bounds":[[0.00018306300000000002,1.5187111999999998,-0.0754269],[0.0363961,1.5666711999999998,-0.049544700000000004]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left rectus capitis posterior minor',
    'Head & Neck',
    'BodyParts3D Concept: left rectus capitis posterior minor (FMA32533)',
    'FMA32533',
    'FMA32533',
    '["FJ1568"]'::jsonb,
    '[[-0.000034127,1.5434811999999998,-0.0826885],[0.0241869,1.5703212,-0.056908600000000004]]'::jsonb,
    'muscular',
    'left rectus capitis posterior minor',
    '{"conceptId":"FMA32533","elements":["FJ1568"],"system":"muscular","bounds":[[-0.000034127,1.5434811999999998,-0.0826885],[0.0241869,1.5703212,-0.056908600000000004]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left rectus capitis lateralis',
    'Head & Neck',
    'BodyParts3D Concept: left rectus capitis lateralis (FMA46318)',
    'FMA46318',
    'FMA46318',
    '["FJ1569"]'::jsonb,
    '[[0.0259777,1.5446512,-0.038335400000000006],[0.040033200000000005,1.5677211999999998,-0.022468100000000005]]'::jsonb,
    'muscular',
    'left rectus capitis lateralis',
    '{"conceptId":"FMA46318","elements":["FJ1569"],"system":"muscular","bounds":[[0.0259777,1.5446512,-0.038335400000000006],[0.040033200000000005,1.5677211999999998,-0.022468100000000005]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left scalenus anterior',
    'Head & Neck',
    'BodyParts3D Concept: left scalenus anterior (FMA13393)',
    'FMA13393',
    'FMA13393',
    '["FJ1570"]'::jsonb,
    '[[0.0210125,1.4123911999999998,-0.021113900000000005],[0.0550162,1.4990712,-0.0031704000000000038]]'::jsonb,
    'muscular',
    'left scalenus anterior',
    '{"conceptId":"FMA13393","elements":["FJ1570"],"system":"muscular","bounds":[[0.0210125,1.4123911999999998,-0.021113900000000005],[0.0550162,1.4990712,-0.0031704000000000038]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left scalenus medius',
    'Head & Neck',
    'BodyParts3D Concept: left scalenus medius (FMA13391)',
    'FMA13391',
    'FMA13391',
    '["FJ1571"]'::jsonb,
    '[[0.0209021,1.4213312,-0.0286357],[0.054277900000000004,1.5267212,-0.013992199999999996]]'::jsonb,
    'muscular',
    'left scalenus medius',
    '{"conceptId":"FMA13391","elements":["FJ1571"],"system":"muscular","bounds":[[0.0209021,1.4213312,-0.0286357],[0.054277900000000004,1.5267212,-0.013992199999999996]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left scalenus posterior',
    'Head & Neck',
    'BodyParts3D Concept: left scalenus posterior (FMA13389)',
    'FMA13389',
    'FMA13389',
    '["FJ1572"]'::jsonb,
    '[[0.0236221,1.4194811999999999,-0.0439244],[0.07275430000000001,1.4810712,-0.018567600000000004]]'::jsonb,
    'muscular',
    'left scalenus posterior',
    '{"conceptId":"FMA13389","elements":["FJ1572"],"system":"muscular","bounds":[[0.0236221,1.4194811999999999,-0.0439244],[0.07275430000000001,1.4810712,-0.018567600000000004]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left sternocleidomastoid',
    'Head & Neck',
    'BodyParts3D Concept: left sternocleidomastoid (FMA13409)',
    'FMA13409',
    'FMA13409',
    '["FJ1573"]'::jsonb,
    '[[0.000579663,1.3801012,-0.0626089],[0.061665500000000005,1.5811312,0.05680600000000002]]'::jsonb,
    'muscular',
    'left sternocleidomastoid',
    '{"conceptId":"FMA13409","elements":["FJ1573"],"system":"muscular","bounds":[[0.000579663,1.3801012,-0.0626089],[0.061665500000000005,1.5811312,0.05680600000000002]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left sternohyoid',
    'Head & Neck',
    'BodyParts3D Concept: left sternohyoid (FMA13347)',
    'FMA13347',
    'FMA13347',
    '["FJ1574"]'::jsonb,
    '[[0.00248157,1.3915812,0.007889999999999994],[0.0249927,1.5071512,0.037632]]'::jsonb,
    'muscular',
    'left sternohyoid',
    '{"conceptId":"FMA13347","elements":["FJ1574"],"system":"muscular","bounds":[[0.00248157,1.3915812,0.007889999999999994],[0.0249927,1.5071512,0.037632]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left sternothyroid',
    'Muscular System',
    'BodyParts3D Concept: left sternothyroid (FMA13351)',
    'FMA13351',
    'FMA13351',
    '["FJ1575"]'::jsonb,
    '[[0.00250418,1.3799412,-0.0034464000000000022],[0.021678799999999998,1.4936212,0.04116499999999998]]'::jsonb,
    'muscular',
    'left sternothyroid',
    '{"conceptId":"FMA13351","elements":["FJ1575"],"system":"muscular","bounds":[[0.00250418,1.3799412,-0.0034464000000000022],[0.021678799999999998,1.4936212,0.04116499999999998]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left stylohyoid',
    'Head & Neck',
    'BodyParts3D Concept: left stylohyoid (FMA45827)',
    'FMA45827',
    'FMA45827',
    '["FJ1576"]'::jsonb,
    '[[0.00903238,1.5077011999999999,-0.015057299999999996],[0.0393847,1.5681312,0.02431499999999999]]'::jsonb,
    'muscular',
    'left stylohyoid',
    '{"conceptId":"FMA45827","elements":["FJ1576"],"system":"muscular","bounds":[[0.00903238,1.5077011999999999,-0.015057299999999996],[0.0393847,1.5681312,0.02431499999999999]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left thyrohyoid',
    'Head & Neck',
    'BodyParts3D Concept: left thyrohyoid (FMA13353)',
    'FMA13353',
    'FMA13353',
    '["FJ1577"]'::jsonb,
    '[[0.00647703,1.4760812,-0.003166100000000005],[0.018758700000000003,1.5069312,0.023105999999999988]]'::jsonb,
    'muscular',
    'left thyrohyoid',
    '{"conceptId":"FMA13353","elements":["FJ1577"],"system":"muscular","bounds":[[0.00647703,1.4760812,-0.003166100000000005],[0.018758700000000003,1.5069312,0.023105999999999988]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right geniohyoid',
    'Head & Neck',
    'BodyParts3D Concept: right geniohyoid (FMA46326)',
    'FMA46326',
    'FMA46326',
    '["FJ1580"]'::jsonb,
    '[[-0.0083421,1.5011611999999999,0.02104099999999999],[-0.000738788,1.5150112,0.060239000000000015]]'::jsonb,
    'muscular',
    'right geniohyoid',
    '{"conceptId":"FMA46326","elements":["FJ1580"],"system":"muscular","bounds":[[-0.0083421,1.5011611999999999,0.02104099999999999],[-0.000738788,1.5150112,0.060239000000000015]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right longus capitis',
    'Muscular System',
    'BodyParts3D Concept: right longus capitis (FMA46309)',
    'FMA46309',
    'FMA46309',
    '["FJ1582"]'::jsonb,
    '[[-0.026782,1.4637912,-0.022804400000000002],[-0.00231143,1.5748012,-0.0049667000000000044]]'::jsonb,
    'muscular',
    'right longus capitis',
    '{"conceptId":"FMA46309","elements":["FJ1582"],"system":"muscular","bounds":[[-0.026782,1.4637912,-0.022804400000000002],[-0.00231143,1.5748012,-0.0049667000000000044]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right mylohyoid',
    'Head & Neck',
    'BodyParts3D Concept: right mylohyoid (FMA46321)',
    'FMA46321',
    'FMA46321',
    '["FJ1583"]'::jsonb,
    '[[-0.026749099999999998,1.5098212,0.022194999999999993],[-0.0006329090000000001,1.5339912,0.05884]]'::jsonb,
    'muscular',
    'right mylohyoid',
    '{"conceptId":"FMA46321","elements":["FJ1583"],"system":"muscular","bounds":[[-0.026749099999999998,1.5098212,0.022194999999999993],[-0.0006329090000000001,1.5339912,0.05884]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right obliquus capitis inferior',
    'Muscular System',
    'BodyParts3D Concept: right obliquus capitis inferior (FMA32536)',
    'FMA32536',
    'FMA32536',
    '["FJ1584"]'::jsonb,
    '[[-0.0404659,1.5144711999999998,-0.06305100000000001],[-0.00161324,1.5483612,-0.025843599999999994]]'::jsonb,
    'muscular',
    'right obliquus capitis inferior',
    '{"conceptId":"FMA32536","elements":["FJ1584"],"system":"muscular","bounds":[[-0.0404659,1.5144711999999998,-0.06305100000000001],[-0.00161324,1.5483612,-0.025843599999999994]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right obliquus capitis superior',
    'Muscular System',
    'BodyParts3D Concept: right obliquus capitis superior (FMA32534)',
    'FMA32534',
    'FMA32534',
    '["FJ1585"]'::jsonb,
    '[[-0.0430231,1.5467812,-0.07951820000000001],[-0.0291242,1.5697211999999998,-0.028712700000000008]]'::jsonb,
    'muscular',
    'right obliquus capitis superior',
    '{"conceptId":"FMA32534","elements":["FJ1585"],"system":"muscular","bounds":[[-0.0430231,1.5467812,-0.07951820000000001],[-0.0291242,1.5697211999999998,-0.028712700000000008]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right omohyoid',
    'Head & Neck',
    'BodyParts3D Concept: right omohyoid (FMA13348)',
    'FMA13348',
    'FMA13348',
    '["FJ1586"]'::jsonb,
    '[[-0.105864,1.3959811999999998,-0.0736079],[-0.0127414,1.5053412,0.022262000000000004]]'::jsonb,
    'muscular',
    'right omohyoid',
    '{"conceptId":"FMA13348","elements":["FJ1586"],"system":"muscular","bounds":[[-0.105864,1.3959811999999998,-0.0736079],[-0.0127414,1.5053412,0.022262000000000004]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right platysma',
    'Muscular System',
    'BodyParts3D Concept: right platysma (FMA45739)',
    'FMA45739',
    'FMA45739',
    '["FJ1587"]'::jsonb,
    '[[-0.147095,1.3975512,-0.050232200000000005],[0.00276451,1.5462612,0.07353499999999999]]'::jsonb,
    'muscular',
    'right platysma',
    '{"conceptId":"FMA45739","elements":["FJ1587"],"system":"muscular","bounds":[[-0.147095,1.3975512,-0.050232200000000005],[0.00276451,1.5462612,0.07353499999999999]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right rectus capitis anterior',
    'Head & Neck',
    'BodyParts3D Concept: right rectus capitis anterior (FMA46313)',
    'FMA46313',
    'FMA46313',
    '["FJ1588"]'::jsonb,
    '[[-0.0289198,1.5505412,-0.021926100000000004],[0.0200233,1.5714912,-0.012318900000000008]]'::jsonb,
    'muscular',
    'right rectus capitis anterior',
    '{"conceptId":"FMA46313","elements":["FJ1588"],"system":"muscular","bounds":[[-0.0289198,1.5505412,-0.021926100000000004],[0.0200233,1.5714912,-0.012318900000000008]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right rectus capitis posterior major',
    'Head & Neck',
    'BodyParts3D Concept: right rectus capitis posterior major (FMA32530)',
    'FMA32530',
    'FMA32530',
    '["FJ1589"]'::jsonb,
    '[[-0.036498800000000005,1.5190512,-0.0754269],[0.0005126960000000001,1.5666912,-0.04951440000000001]]'::jsonb,
    'muscular',
    'right rectus capitis posterior major',
    '{"conceptId":"FMA32530","elements":["FJ1589"],"system":"muscular","bounds":[[-0.036498800000000005,1.5190512,-0.0754269],[0.0005126960000000001,1.5666912,-0.04951440000000001]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right rectus capitis posterior minor',
    'Head & Neck',
    'BodyParts3D Concept: right rectus capitis posterior minor (FMA32532)',
    'FMA32532',
    'FMA32532',
    '["FJ1590"]'::jsonb,
    '[[-0.024278300000000003,1.5434211999999998,-0.0826865],[-0.000401029,1.5703112,-0.055439600000000006]]'::jsonb,
    'muscular',
    'right rectus capitis posterior minor',
    '{"conceptId":"FMA32532","elements":["FJ1590"],"system":"muscular","bounds":[[-0.024278300000000003,1.5434211999999998,-0.0826865],[-0.000401029,1.5703112,-0.055439600000000006]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right rectus capitis lateralis',
    'Head & Neck',
    'BodyParts3D Concept: right rectus capitis lateralis (FMA46317)',
    'FMA46317',
    'FMA46317',
    '["FJ1591"]'::jsonb,
    '[[-0.0412495,1.5462212,-0.03830480000000001],[-0.028194,1.5677712000000001,-0.022065799999999997]]'::jsonb,
    'muscular',
    'right rectus capitis lateralis',
    '{"conceptId":"FMA46317","elements":["FJ1591"],"system":"muscular","bounds":[[-0.0412495,1.5462212,-0.03830480000000001],[-0.028194,1.5677712000000001,-0.022065799999999997]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right scalenus anterior',
    'Head & Neck',
    'BodyParts3D Concept: right scalenus anterior (FMA13392)',
    'FMA13392',
    'FMA13392',
    '["FJ1592"]'::jsonb,
    '[[-0.0563191,1.4124412,-0.021195800000000015],[-0.0223265,1.4991012,-0.0031941999999999943]]'::jsonb,
    'muscular',
    'right scalenus anterior',
    '{"conceptId":"FMA13392","elements":["FJ1592"],"system":"muscular","bounds":[[-0.0563191,1.4124412,-0.021195800000000015],[-0.0223265,1.4991012,-0.0031941999999999943]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right scalenus medius',
    'Head & Neck',
    'BodyParts3D Concept: right scalenus medius (FMA13390)',
    'FMA13390',
    'FMA13390',
    '["FJ1593"]'::jsonb,
    '[[-0.0555911,1.4212912,-0.028659000000000004],[-0.0221477,1.5267212,-0.014022900000000005]]'::jsonb,
    'muscular',
    'right scalenus medius',
    '{"conceptId":"FMA13390","elements":["FJ1593"],"system":"muscular","bounds":[[-0.0555911,1.4212912,-0.028659000000000004],[-0.0221477,1.5267212,-0.014022900000000005]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right scalenus posterior',
    'Head & Neck',
    'BodyParts3D Concept: right scalenus posterior (FMA13388)',
    'FMA13388',
    'FMA13388',
    '["FJ1594"]'::jsonb,
    '[[-0.0740721,1.4194312,-0.0439227],[-0.024892800000000003,1.4810512,-0.018580399999999997]]'::jsonb,
    'muscular',
    'right scalenus posterior',
    '{"conceptId":"FMA13388","elements":["FJ1594"],"system":"muscular","bounds":[[-0.0740721,1.4194312,-0.0439227],[-0.024892800000000003,1.4810512,-0.018580399999999997]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right sternocleidomastoid',
    'Head & Neck',
    'BodyParts3D Concept: right sternocleidomastoid (FMA13408)',
    'FMA13408',
    'FMA13408',
    '["FJ1595"]'::jsonb,
    '[[-0.06304,1.3800812,-0.0627461],[0.061405,1.5813012,0.05690700000000001]]'::jsonb,
    'muscular',
    'right sternocleidomastoid',
    '{"conceptId":"FMA13408","elements":["FJ1595"],"system":"muscular","bounds":[[-0.06304,1.3800812,-0.0627461],[0.061405,1.5813012,0.05690700000000001]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right sternohyoid',
    'Head & Neck',
    'BodyParts3D Concept: right sternohyoid (FMA13346)',
    'FMA13346',
    'FMA13346',
    '["FJ1596"]'::jsonb,
    '[[-0.0262347,1.3915612,0.007832999999999993],[-0.00376191,1.5071412,0.03778000000000001]]'::jsonb,
    'muscular',
    'right sternohyoid',
    '{"conceptId":"FMA13346","elements":["FJ1596"],"system":"muscular","bounds":[[-0.0262347,1.3915612,0.007832999999999993],[-0.00376191,1.5071412,0.03778000000000001]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right sternothyroid',
    'Muscular System',
    'BodyParts3D Concept: right sternothyroid (FMA13350)',
    'FMA13350',
    'FMA13350',
    '["FJ1597"]'::jsonb,
    '[[-0.0229758,1.3799112,-0.0034348000000000017],[-0.00378496,1.4938412,0.041243]]'::jsonb,
    'muscular',
    'right sternothyroid',
    '{"conceptId":"FMA13350","elements":["FJ1597"],"system":"muscular","bounds":[[-0.0229758,1.3799112,-0.0034348000000000017],[-0.00378496,1.4938412,0.041243]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right stylohyoid',
    'Head & Neck',
    'BodyParts3D Concept: right stylohyoid (FMA45826)',
    'FMA45826',
    'FMA45826',
    '["FJ1598"]'::jsonb,
    '[[-0.040708100000000004,1.5077712,-0.015059299999999998],[-0.0102945,1.5678412,0.02430299999999999]]'::jsonb,
    'muscular',
    'right stylohyoid',
    '{"conceptId":"FMA45826","elements":["FJ1598"],"system":"muscular","bounds":[[-0.040708100000000004,1.5077712,-0.015059299999999998],[-0.0102945,1.5678412,0.02430299999999999]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right thyrohyoid',
    'Head & Neck',
    'BodyParts3D Concept: right thyrohyoid (FMA13352)',
    'FMA13352',
    'FMA13352',
    '["FJ1599"]'::jsonb,
    '[[-0.020162500000000003,1.4760612,-0.003168000000000004],[0.0175242,1.5069312,0.023117999999999986]]'::jsonb,
    'muscular',
    'right thyrohyoid',
    '{"conceptId":"FMA13352","elements":["FJ1599"],"system":"muscular","bounds":[[-0.020162500000000003,1.4760612,-0.003168000000000004],[0.0175242,1.5069312,0.023117999999999986]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Superior oblique part of left longus colli',
    'Core',
    'BodyParts3D Concept: superior oblique part of left longus colli (FMA46284)',
    'FMA46284',
    'FMA46284',
    '["FJ1600"]'::jsonb,
    '[[-0.000541523,1.4829511999999998,-0.02604680000000001],[0.0246981,1.5500712,-0.009195700000000001]]'::jsonb,
    'muscular',
    'superior oblique part of left longus colli',
    '{"conceptId":"FMA46284","elements":["FJ1600"],"system":"muscular","bounds":[[-0.000541523,1.4829511999999998,-0.02604680000000001],[0.0246981,1.5500712,-0.009195700000000001]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Vertical intermediate part of left longus colli',
    'Muscular System',
    'BodyParts3D Concept: vertical intermediate part of left longus colli (FMA46286)',
    'FMA46286',
    'FMA46286',
    '["FJ1601"]'::jsonb,
    '[[-0.00033104099999999996,1.4116712,-0.024607699999999996],[0.0148369,1.5493911999999999,-0.007947300000000004]]'::jsonb,
    'muscular',
    'vertical intermediate part of left longus colli',
    '{"conceptId":"FMA46286","elements":["FJ1601"],"system":"muscular","bounds":[[-0.00033104099999999996,1.4116712,-0.024607699999999996],[0.0148369,1.5493911999999999,-0.007947300000000004]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Anterolateral head of lateral papillary muscle of left ventricle',
    'Muscular System',
    'BodyParts3D Concept: anterolateral head of lateral papillary muscle of left ventricle (FMA7265)',
    'FMA7265',
    'FMA7265',
    '["FJ2418"]'::jsonb,
    '[[0.0315447,1.2699212,0.024511999999999992],[0.0565892,1.3027612,0.060032]]'::jsonb,
    'muscular',
    'anterolateral head of lateral papillary muscle of left ventricle',
    '{"conceptId":"FMA7265","elements":["FJ2418"],"system":"muscular","bounds":[[0.0315447,1.2699212,0.024511999999999992],[0.0565892,1.3027612,0.060032]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Anterior papillary muscle of right ventricle',
    'Muscular System',
    'BodyParts3D Concept: anterior papillary muscle of right ventricle (FMA7260)',
    'FMA7260',
    'FMA7260',
    '["FJ2419"]'::jsonb,
    '[[0.0120583,1.2579112,0.05113100000000001],[0.0471424,1.2871612,0.07271]]'::jsonb,
    'muscular',
    'anterior papillary muscle of right ventricle',
    '{"conceptId":"FMA7260","elements":["FJ2419"],"system":"muscular","bounds":[[0.0120583,1.2579112,0.05113100000000001],[0.0471424,1.2871612,0.07271]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Lateral papillary muscle of left ventricle',
    'Muscular System',
    'BodyParts3D Concept: lateral papillary muscle of left ventricle (FMA7264)',
    'FMA7264',
    'FMA7264',
    '["FJ2418","FJ2429"]'::jsonb,
    '[[0.0464648,1.2665512,0.0047669999999999935],[0.0745404,1.2963712,0.04691999999999999]]'::jsonb,
    'muscular',
    'lateral papillary muscle of left ventricle',
    '{"conceptId":"FMA7264","elements":["FJ2418","FJ2429"],"system":"muscular","bounds":[[0.0464648,1.2665512,0.0047669999999999935],[0.0745404,1.2963712,0.04691999999999999]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Posterior papillary muscle of right ventricle',
    'Muscular System',
    'BodyParts3D Concept: posterior papillary muscle of right ventricle (FMA7261)',
    'FMA7261',
    'FMA7261',
    '["FJ2430"]'::jsonb,
    '[[0.00716454,1.2565512,0.031886],[0.0367766,1.2709012,0.060418]]'::jsonb,
    'muscular',
    'posterior papillary muscle of right ventricle',
    '{"conceptId":"FMA7261","elements":["FJ2430"],"system":"muscular","bounds":[[0.00716454,1.2565512,0.031886],[0.0367766,1.2709012,0.060418]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Septal papillary muscle of right ventricle',
    'Muscular System',
    'BodyParts3D Concept: septal papillary muscle of right ventricle (FMA7262)',
    'FMA7262',
    'FMA7262',
    '["FJ2437"]'::jsonb,
    '[[0.0128912,1.2915712,0.028194999999999998],[0.032174100000000004,1.3182812,0.043599]]'::jsonb,
    'muscular',
    'septal papillary muscle of right ventricle',
    '{"conceptId":"FMA7262","elements":["FJ2437"],"system":"muscular","bounds":[[0.0128912,1.2915712,0.028194999999999998],[0.032174100000000004,1.3182812,0.043599]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right coccygeus',
    'Muscular System',
    'BodyParts3D Concept: right coccygeus (FMA46443)',
    'FMA46443',
    'FMA46443',
    '["FJ2547"]'::jsonb,
    '[[-0.0487138,0.8661892,-0.09129048000000001],[-0.00247649,0.9067352000000001,-0.0619615]]'::jsonb,
    'muscular',
    'right coccygeus',
    '{"conceptId":"FMA46443","elements":["FJ2547"],"system":"muscular","bounds":[[-0.0487138,0.8661892,-0.09129048000000001],[-0.00247649,0.9067352000000001,-0.0619615]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right iliococcygeus',
    'Muscular System',
    'BodyParts3D Concept: right iliococcygeus (FMA45858)',
    'FMA45858',
    'FMA45858',
    '["FJ2549"]'::jsonb,
    '[[-0.0491884,0.8542052000000001,-0.08494710000000001],[0.0443877,0.8998332,-0.011805800000000005]]'::jsonb,
    'muscular',
    'right iliococcygeus',
    '{"conceptId":"FMA45858","elements":["FJ2549"],"system":"muscular","bounds":[[-0.0491884,0.8542052000000001,-0.08494710000000001],[0.0443877,0.8998332,-0.011805800000000005]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right pubococcygeus',
    'Muscular System',
    'BodyParts3D Concept: right pubococcygeus (FMA45854)',
    'FMA45854',
    'FMA45854',
    '["FJ2550"]'::jsonb,
    '[[-0.0354065,0.8453572,-0.089518],[0.0282547,0.8927342000000001,0.0005300000000000027]]'::jsonb,
    'muscular',
    'right pubococcygeus',
    '{"conceptId":"FMA45854","elements":["FJ2550"],"system":"muscular","bounds":[[-0.0354065,0.8453572,-0.089518],[0.0282547,0.8927342000000001,0.0005300000000000027]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right puborectalis',
    'Muscular System',
    'BodyParts3D Concept: right puborectalis (FMA45856)',
    'FMA45856',
    'FMA45856',
    '["FJ2551"]'::jsonb,
    '[[-0.0324661,0.8411192000000001,-0.0786943],[0.0246095,0.8699272000000001,0.002803]]'::jsonb,
    'muscular',
    'right puborectalis',
    '{"conceptId":"FMA45856","elements":["FJ2551"],"system":"muscular","bounds":[[-0.0324661,0.8411192000000001,-0.0786943],[0.0246095,0.8699272000000001,0.002803]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left genioglossus',
    'Muscular System',
    'BodyParts3D Concept: left genioglossus (FMA46702)',
    'FMA46702',
    'FMA46702',
    '["FJ2738"]'::jsonb,
    '[[-0.00150631,1.5060812,0.017236],[0.00727159,1.5342912,0.06454599999999999]]'::jsonb,
    'muscular',
    'left genioglossus',
    '{"conceptId":"FMA46702","elements":["FJ2738"],"system":"muscular","bounds":[[-0.00150631,1.5060812,0.017236],[0.00727159,1.5342912,0.06454599999999999]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left hyoglossus',
    'Muscular System',
    'BodyParts3D Concept: left hyoglossus (FMA46704)',
    'FMA46704',
    'FMA46704',
    '["FJ2739"]'::jsonb,
    '[[0.00378822,1.5034611999999998,0.021838999999999997],[0.011698100000000001,1.5272012,0.051413000000000014]]'::jsonb,
    'muscular',
    'left hyoglossus',
    '{"conceptId":"FMA46704","elements":["FJ2739"],"system":"muscular","bounds":[[0.00378822,1.5034611999999998,0.021838999999999997],[0.011698100000000001,1.5272012,0.051413000000000014]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left levator veli palatini',
    'Muscular System',
    'BodyParts3D Concept: left levator veli palatini (FMA46729)',
    'FMA46729',
    'FMA46729',
    '["FJ2741"]'::jsonb,
    '[[0.0013861000000000001,1.5417912,-0.01181950000000001],[0.0313553,1.5750912,0.01010599999999999]]'::jsonb,
    'muscular',
    'left levator veli palatini',
    '{"conceptId":"FMA46729","elements":["FJ2741"],"system":"muscular","bounds":[[0.0013861000000000001,1.5417912,-0.01181950000000001],[0.0313553,1.5750912,0.01010599999999999]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left tensor veli palatini',
    'Muscular System',
    'BodyParts3D Concept: left tensor veli palatini (FMA46732)',
    'FMA46732',
    'FMA46732',
    '["FJ2748"]'::jsonb,
    '[[0.000760697,1.5391112,0.00009999999999998899],[0.016656900000000002,1.5814511999999998,0.020491999999999996]]'::jsonb,
    'muscular',
    'left tensor veli palatini',
    '{"conceptId":"FMA46732","elements":["FJ2748"],"system":"muscular","bounds":[[0.000760697,1.5391112,0.00009999999999998899],[0.016656900000000002,1.5814511999999998,0.020491999999999996]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right genioglossus',
    'Muscular System',
    'BodyParts3D Concept: right genioglossus (FMA46698)',
    'FMA46698',
    'FMA46698',
    '["FJ2750"]'::jsonb,
    '[[-0.00858361,1.5060612,0.017240999999999992],[-0.0006507030000000001,1.5342912,0.06454099999999999]]'::jsonb,
    'muscular',
    'right genioglossus',
    '{"conceptId":"FMA46698","elements":["FJ2750"],"system":"muscular","bounds":[[-0.00858361,1.5060612,0.017240999999999992],[-0.0006507030000000001,1.5342912,0.06454099999999999]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right hyoglossus',
    'Muscular System',
    'BodyParts3D Concept: right hyoglossus (FMA46703)',
    'FMA46703',
    'FMA46703',
    '["FJ2751"]'::jsonb,
    '[[-0.0129692,1.5034712,0.02183199999999999],[-0.00509714,1.5271911999999999,0.05141900000000002]]'::jsonb,
    'muscular',
    'right hyoglossus',
    '{"conceptId":"FMA46703","elements":["FJ2751"],"system":"muscular","bounds":[[-0.0129692,1.5034712,0.02183199999999999],[-0.00509714,1.5271911999999999,0.05141900000000002]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right levator veli palatini',
    'Muscular System',
    'BodyParts3D Concept: right levator veli palatini (FMA46728)',
    'FMA46728',
    'FMA46728',
    '["FJ2753"]'::jsonb,
    '[[-0.0326653,1.5418012,-0.011820300000000006],[-0.0025623300000000002,1.5751012,0.010099999999999998]]'::jsonb,
    'muscular',
    'right levator veli palatini',
    '{"conceptId":"FMA46728","elements":["FJ2753"],"system":"muscular","bounds":[[-0.0326653,1.5418012,-0.011820300000000006],[-0.0025623300000000002,1.5751012,0.010099999999999998]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right tensor veli palatini',
    'Muscular System',
    'BodyParts3D Concept: right tensor veli palatini (FMA46731)',
    'FMA46731',
    'FMA46731',
    '["FJ2760"]'::jsonb,
    '[[-0.0179738,1.5391012,0.00009999999999998899],[-0.00206905,1.5814612,0.020495]]'::jsonb,
    'muscular',
    'right tensor veli palatini',
    '{"conceptId":"FMA46731","elements":["FJ2760"],"system":"muscular","bounds":[[-0.0179738,1.5391012,0.00009999999999998899],[-0.00206905,1.5814612,0.020495]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Uvular muscle',
    'Muscular System',
    'BodyParts3D Concept: uvular muscle (FMA46733)',
    'FMA46733',
    'FMA46733',
    '["FJ2762"]'::jsonb,
    '[[-0.00324152,1.5467111999999998,-0.0021175999999999973],[0.0017569999999999999,1.5560012,0.0023959999999999954]]'::jsonb,
    'muscular',
    'uvular muscle',
    '{"conceptId":"FMA46733","elements":["FJ2762"],"system":"muscular","bounds":[[-0.00324152,1.5467111999999998,-0.0021175999999999973],[0.0017569999999999999,1.5560012,0.0023959999999999954]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left aryepiglotticus',
    'Muscular System',
    'BodyParts3D Concept: left aryepiglotticus (FMA46605)',
    'FMA46605',
    'FMA46605',
    '["FJ2774"]'::jsonb,
    '[[0.0035512,1.4875312,-0.0032178000000000068],[0.00785456,1.5105612,0.008821999999999997]]'::jsonb,
    'muscular',
    'left aryepiglotticus',
    '{"conceptId":"FMA46605","elements":["FJ2774"],"system":"muscular","bounds":[[0.0035512,1.4875312,-0.0032178000000000068],[0.00785456,1.5105612,0.008821999999999997]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left lateral crico-arytenoid',
    'Muscular System',
    'BodyParts3D Concept: left lateral crico-arytenoid (FMA46581)',
    'FMA46581',
    'FMA46581',
    '["FJ2778"]'::jsonb,
    '[[0.00596481,1.4725312,-0.002742400000000006],[0.010436299999999999,1.4833412,0.007313999999999987]]'::jsonb,
    'muscular',
    'left lateral crico-arytenoid',
    '{"conceptId":"FMA46581","elements":["FJ2778"],"system":"muscular","bounds":[[0.00596481,1.4725312,-0.002742400000000006],[0.010436299999999999,1.4833412,0.007313999999999987]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left oblique arytenoid',
    'Core',
    'BodyParts3D Concept: left oblique arytenoid (FMA46585)',
    'FMA46585',
    'FMA46585',
    '["FJ2780"]'::jsonb,
    '[[-0.007297240000000001,1.4817112,-0.006377399999999991],[0.00565565,1.4883312,-0.003221700000000008]]'::jsonb,
    'muscular',
    'left oblique arytenoid',
    '{"conceptId":"FMA46585","elements":["FJ2780"],"system":"muscular","bounds":[[-0.007297240000000001,1.4817112,-0.006377399999999991],[0.00565565,1.4883312,-0.003221700000000008]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Oblique part of left cricothyroid',
    'Core',
    'BodyParts3D Concept: oblique part of left cricothyroid (FMA46614)',
    'FMA46614',
    'FMA46614',
    '["FJ2781"]'::jsonb,
    '[[0.0035398,1.4663912,-0.0065023000000000025],[0.0118537,1.4795312,0.009691000000000005]]'::jsonb,
    'muscular',
    'oblique part of left cricothyroid',
    '{"conceptId":"FMA46614","elements":["FJ2781"],"system":"muscular","bounds":[[0.0035398,1.4663912,-0.0065023000000000025],[0.0118537,1.4795312,0.009691000000000005]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left posterior crico-arytenoid',
    'Muscular System',
    'BodyParts3D Concept: left posterior crico-arytenoid (FMA46578)',
    'FMA46578',
    'FMA46578',
    '["FJ2782"]'::jsonb,
    '[[0.0009708329999999999,1.4686612,-0.0073377000000000026],[0.010085100000000001,1.4830312,-0.0015939000000000092]]'::jsonb,
    'muscular',
    'left posterior crico-arytenoid',
    '{"conceptId":"FMA46578","elements":["FJ2782"],"system":"muscular","bounds":[[0.0009708329999999999,1.4686612,-0.0073377000000000026],[0.010085100000000001,1.4830312,-0.0015939000000000092]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Straight part of left cricothyroid',
    'Muscular System',
    'BodyParts3D Concept: straight part of left cricothyroid (FMA46612)',
    'FMA46612',
    'FMA46612',
    '["FJ2783"]'::jsonb,
    '[[0.0009601960000000001,1.4663512,0.004615999999999995],[0.010697,1.4766712,0.011489]]'::jsonb,
    'muscular',
    'straight part of left cricothyroid',
    '{"conceptId":"FMA46612","elements":["FJ2783"],"system":"muscular","bounds":[[0.0009601960000000001,1.4663512,0.004615999999999995],[0.010697,1.4766712,0.011489]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left thyro-arytenoid',
    'Muscular System',
    'BodyParts3D Concept: left thyro-arytenoid (FMA46590)',
    'FMA46590',
    'FMA46590',
    '["FJ2784","FJ2785"]'::jsonb,
    '[[0.00108852,1.4804312,-0.0041443000000000035],[0.00703624,1.4896212,0.01669899999999999]]'::jsonb,
    'muscular',
    'left thyro-arytenoid',
    '{"conceptId":"FMA46590","elements":["FJ2784","FJ2785"],"system":"muscular","bounds":[[0.00108852,1.4804312,-0.0041443000000000035],[0.00703624,1.4896212,0.01669899999999999]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Left vocalis',
    'Muscular System',
    'BodyParts3D Concept: left vocalis (FMA46593)',
    'FMA46593',
    'FMA46593',
    '["FJ2788"]'::jsonb,
    '[[0.0011831,1.4818112,0.0008829999999999949],[0.00277049,1.4832412000000001,0.014978999999999992]]'::jsonb,
    'muscular',
    'left vocalis',
    '{"conceptId":"FMA46593","elements":["FJ2788"],"system":"muscular","bounds":[[0.0011831,1.4818112,0.0008829999999999949],[0.00277049,1.4832412000000001,0.014978999999999992]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right aryepiglotticus',
    'Muscular System',
    'BodyParts3D Concept: right aryepiglotticus (FMA46604)',
    'FMA46604',
    'FMA46604',
    '["FJ2791"]'::jsonb,
    '[[-0.0091688,1.4875312,-0.0032211000000000045],[0.0075112,1.5105612,0.008822999999999984]]'::jsonb,
    'muscular',
    'right aryepiglotticus',
    '{"conceptId":"FMA46604","elements":["FJ2791"],"system":"muscular","bounds":[[-0.0091688,1.4875312,-0.0032211000000000045],[0.0075112,1.5105612,0.008822999999999984]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right lateral crico-arytenoid',
    'Muscular System',
    'BodyParts3D Concept: right lateral crico-arytenoid (FMA46580)',
    'FMA46580',
    'FMA46580',
    '["FJ2796"]'::jsonb,
    '[[-0.0117348,1.4725312,-0.0027400999999999953],[-0.00728367,1.4833412,0.007311999999999999]]'::jsonb,
    'muscular',
    'right lateral crico-arytenoid',
    '{"conceptId":"FMA46580","elements":["FJ2796"],"system":"muscular","bounds":[[-0.0117348,1.4725312,-0.0027400999999999953],[-0.00728367,1.4833412,0.007311999999999999]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right oblique arytenoid',
    'Core',
    'BodyParts3D Concept: right oblique arytenoid (FMA46584)',
    'FMA46584',
    'FMA46584',
    '["FJ2798"]'::jsonb,
    '[[-0.00696925,1.4817212,-0.00638190000000001],[0.00597263,1.4883412,-0.0032334000000000113]]'::jsonb,
    'muscular',
    'right oblique arytenoid',
    '{"conceptId":"FMA46584","elements":["FJ2798"],"system":"muscular","bounds":[[-0.00696925,1.4817212,-0.00638190000000001],[0.00597263,1.4883412,-0.0032334000000000113]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Oblique part of right cricothyroid',
    'Core',
    'BodyParts3D Concept: oblique part of right cricothyroid (FMA46613)',
    'FMA46613',
    'FMA46613',
    '["FJ2799"]'::jsonb,
    '[[-0.0131716,1.4664012,-0.0064902000000000015],[-0.00484406,1.4795112000000001,0.00968899999999999]]'::jsonb,
    'muscular',
    'oblique part of right cricothyroid',
    '{"conceptId":"FMA46613","elements":["FJ2799"],"system":"muscular","bounds":[[-0.0131716,1.4664012,-0.0064902000000000015],[-0.00484406,1.4795112000000001,0.00968899999999999]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right posterior crico-arytenoid',
    'Muscular System',
    'BodyParts3D Concept: right posterior crico-arytenoid (FMA46577)',
    'FMA46577',
    'FMA46577',
    '["FJ2800"]'::jsonb,
    '[[-0.0113752,1.4686612,-0.007340100000000016],[-0.00227576,1.4830312,-0.0016084000000000098]]'::jsonb,
    'muscular',
    'right posterior crico-arytenoid',
    '{"conceptId":"FMA46577","elements":["FJ2800"],"system":"muscular","bounds":[[-0.0113752,1.4686612,-0.007340100000000016],[-0.00227576,1.4830312,-0.0016084000000000098]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Straight part of right cricothyroid',
    'Muscular System',
    'BodyParts3D Concept: straight part of right cricothyroid (FMA46611)',
    'FMA46611',
    'FMA46611',
    '["FJ2801"]'::jsonb,
    '[[-0.012019700000000001,1.4663712,0.004646999999999998],[0.01044,1.4766712,0.011489999999999986]]'::jsonb,
    'muscular',
    'straight part of right cricothyroid',
    '{"conceptId":"FMA46611","elements":["FJ2801"],"system":"muscular","bounds":[[-0.012019700000000001,1.4663712,0.004646999999999998],[0.01044,1.4766712,0.011489999999999986]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right thyro-arytenoid',
    'Muscular System',
    'BodyParts3D Concept: right thyro-arytenoid (FMA46589)',
    'FMA46589',
    'FMA46589',
    '["FJ2802","FJ2803"]'::jsonb,
    '[[-0.008365309999999999,1.4804612,-0.004157500000000008],[-0.00239785,1.4896112,0.016706]]'::jsonb,
    'muscular',
    'right thyro-arytenoid',
    '{"conceptId":"FMA46589","elements":["FJ2802","FJ2803"],"system":"muscular","bounds":[[-0.008365309999999999,1.4804612,-0.004157500000000008],[-0.00239785,1.4896112,0.016706]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Right vocalis',
    'Muscular System',
    'BodyParts3D Concept: right vocalis (FMA46592)',
    'FMA46592',
    'FMA46592',
    '["FJ2806"]'::jsonb,
    '[[-0.00408703,1.4818012,0.0008799999999999919],[-0.00249583,1.4832412000000001,0.014970999999999998]]'::jsonb,
    'muscular',
    'right vocalis',
    '{"conceptId":"FMA46592","elements":["FJ2806"],"system":"muscular","bounds":[[-0.00408703,1.4818012,0.0008799999999999919],[-0.00249583,1.4832412000000001,0.014970999999999998]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Transverse arytenoid',
    'Muscular System',
    'BodyParts3D Concept: transverse arytenoid (FMA46582)',
    'FMA46582',
    'FMA46582',
    '["FJ2809"]'::jsonb,
    '[[-0.008016170000000001,1.4815212,-0.005299800000000007],[0.00669442,1.4877612,-0.002224900000000002]]'::jsonb,
    'muscular',
    'transverse arytenoid',
    '{"conceptId":"FMA46582","elements":["FJ2809"],"system":"muscular","bounds":[[-0.008016170000000001,1.4815212,-0.005299800000000007],[0.00669442,1.4877612,-0.002224900000000002]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
INSERT INTO public.muscles (
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
    'Diaphragm',
    'Core',
    'BodyParts3D Concept: diaphragm (FMA13295)',
    'FMA13295',
    'FMA13295',
    '["FJ3131"]'::jsonb,
    '[[-0.122329,1.0639631999999999,-0.0740842],[0.120863,1.2706912,0.105323]]'::jsonb,
    'muscular',
    'diaphragm',
    '{"conceptId":"FMA13295","elements":["FJ3131"],"system":"muscular","bounds":[[-0.122329,1.0639631999999999,-0.0740842],[0.120863,1.2706912,0.105323]]}'
) ON CONFLICT (name) DO UPDATE SET
    concept_id = EXCLUDED.concept_id,
    fma_id = EXCLUDED.fma_id,
    element_ids = EXCLUDED.element_ids,
    bounds = EXCLUDED.bounds,
    system = EXCLUDED.system;
