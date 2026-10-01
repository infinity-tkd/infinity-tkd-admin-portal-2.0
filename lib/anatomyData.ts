export interface AnatomicalStructure {
  id: string;
  commonName: string;
  latinName: string;
  category: 'superficial_muscle' | 'deep_muscle' | 'tendon_ligament' | 'skeletal_structure';
  system: 'Muscular' | 'Connective' | 'Skeletal';
  origin: string;
  insertion: string;
  primaryAction: string;
  secondaryAction?: string;
  tkdRelevance: string;
  primaryExercises: string[];
  injuryRisks: string;
  preventionTip: string;
  cameraFocus: {
    target: [number, number, number];
    distance: number;
    recommendedView?: 'front' | 'back' | 'left' | 'right';
  };
}

export const ANATOMY_DATABASE: Record<string, AnatomicalStructure> = {
  // 1. QUADRICEPS
  'Quadriceps': {
    id: 'Quadriceps',
    commonName: 'Quadriceps Femoris',
    latinName: 'Musculus quadriceps femoris (Rectus femoris, Vastus lateralis, Vastus medialis, Vastus intermedius)',
    category: 'superficial_muscle',
    system: 'Muscular',
    origin: 'Anterior inferior iliac spine (Rectus femoris), Greater trochanter & Linea aspera of femur (Vasti group)',
    insertion: 'Patella via Quadriceps tendon, continuing to Tibial tuberosity via Patellar ligament',
    primaryAction: 'Powerful knee extension; hip flexion (rectus femoris only)',
    secondaryAction: 'Patellar tracking stabilization during knee flexion and load-bearing deceleration',
    tkdRelevance: 'Primary engine for explosive knee snap in linear and snapping kicks (Ap Chagi, Dollyo Chagi). Absorbs landing impact after jumping kicks (Twimyeo kicks).',
    primaryExercises: ['Front Squats', 'Bulgarian Split Squats', 'Sissy Squats', 'Terminal Knee Extensions (TKEs)'],
    injuryRisks: 'Quad strain / micro-tears during violent snap extension without proper deceleration; patellar tendinopathy from repeated high-impact landings.',
    preventionTip: 'Perform eccentric quad loading (Nordic quad drops) and foam roll the rectus femoris to prevent excessive tension on the patellar tendon.',
    cameraFocus: {
      target: [0, -0.45, 0],
      distance: 2.2,
      recommendedView: 'front',
    },
  },

  // 2. HAMSTRINGS
  'Hamstrings': {
    id: 'Hamstrings',
    commonName: 'Hamstrings',
    latinName: 'Musculi ischiocrurales (Biceps femoris, Semitendinosus, Semimembranosus)',
    category: 'superficial_muscle',
    system: 'Muscular',
    origin: 'Ischial tuberosity of pelvis; Linea aspera of femur (biceps femoris short head)',
    insertion: 'Head of fibula (lateral) and medial condyle of tibia (pes anserinus / medial)',
    primaryAction: 'Knee flexion, hip extension',
    secondaryAction: 'Medial and lateral rotation of flexed knee; stabilizes pelvis during anterior tilt',
    tkdRelevance: 'Crucial deceleration brake during the terminal snap of high roundhouse (Dollyo) and side (Yop) kicks. Generates backward drive in Back Kicks (Dwit Chagi).',
    primaryExercises: ['Nordic Hamstring Curls', 'Romanian Deadlifts (RDL)', 'Single-Leg Swiss Ball Leg Curls'],
    injuryRisks: 'Acute hamstring tears/strains during uncontrolled terminal kick whip or overstriding in sparring lunges.',
    preventionTip: 'Focus on high-speed eccentric deceleration conditioning. Always dynamic warm-up the posterior chain before high-velocity ballistic kicking.',
    cameraFocus: {
      target: [0, -0.45, 0],
      distance: 2.2,
      recommendedView: 'back',
    },
  },

  // 3. GLUTES
  'Glutes': {
    id: 'Glutes',
    commonName: 'Gluteal Complex',
    latinName: 'Musculus gluteus maximus, medius, and minimus',
    category: 'superficial_muscle',
    system: 'Muscular',
    origin: 'Ilium posterior to gluteal lines, sacrum, coccyx, and sacrotuberous ligament',
    insertion: 'Gluteal tuberosity of femur, Iliotibial tract (ITB), and greater trochanter of femur',
    primaryAction: 'Hip extension, hip abduction, external rotation (maximus), pelvic leveling in single-leg stance (medius/minimus)',
    secondaryAction: 'Transverse pelvic rotation driving rotational kick velocity',
    tkdRelevance: 'The kinetic core of all Taekwondo kicks. Gluteus medius provides single-leg balance on the pivot foot, while maximus powers hip thrust in Yop Chagi and Dwit Chagi.',
    primaryExercises: ['Barbell Hip Thrusts', 'Side-Lying Clamshells with Band', 'Lateral Cable Hip Abductions', 'Single-Leg Deadlifts'],
    injuryRisks: 'Gluteal tendinopathy, deep gluteal syndrome (piriformis compression of sciatic nerve), and pivot-leg stabilization fatigue.',
    preventionTip: 'Activate gluteus medius prior to kicking sessions using isometric lateral walks to prevent hip drop and medial knee collapse.',
    cameraFocus: {
      target: [0, -0.15, 0],
      distance: 2.4,
      recommendedView: 'back',
    },
  },

  // 4. CALVES
  'Calves': {
    id: 'Calves',
    commonName: 'Calves (Triceps Surae)',
    latinName: 'Musculus triceps surae (Gastrocnemius medial & lateral heads, Soleus)',
    category: 'superficial_muscle',
    system: 'Muscular',
    origin: 'Lateral and medial femoral condyles (Gastrocnemius); Posterior tibia and fibula (Soleus)',
    insertion: 'Posterior surface of calcaneus (heel bone) via the Achilles tendon (Tendo calcaneus)',
    primaryAction: 'Plantar flexion of foot, knee flexion assistance (gastrocnemius)',
    secondaryAction: 'Ankle joint stabilization and elastic energy recoil in bounce footwork',
    tkdRelevance: 'Powers the dynamic bouncy fighting stance (Kyeorugi stance), explosive forward dash, and rapid pivot on the ball of the foot.',
    primaryExercises: ['Standing Calf Raises', 'Seated Bent-Knee Soleus Raises', 'Plyometric Pogo Hops', 'Agility Ladder Drills'],
    injuryRisks: 'Achilles tendinitis, medial gastrocnemius tear ("tennis leg") during explosive lunging from a cold stance.',
    preventionTip: 'Incorporate eccentric heel drops off an elevated step. Ensure complete calf-to-ankle warm-up before explosive footwork.',
    cameraFocus: {
      target: [0, -0.75, 0],
      distance: 1.8,
      recommendedView: 'back',
    },
  },

  // 5. HIP FLEXORS
  'Hip Flexors': {
    id: 'Hip Flexors',
    commonName: 'Hip Flexors (Iliopsoas)',
    latinName: 'Musculus iliopsoas (Psoas major & Iliacus)',
    category: 'deep_muscle',
    system: 'Muscular',
    origin: 'T12-L5 vertebrae and intervertebral discs (Psoas); Iliac fossa of pelvis (Iliacus)',
    insertion: 'Lesser trochanter of femur',
    primaryAction: 'Primary powerful hip flexion; stabilizes lumbar spine in upright posture',
    secondaryAction: 'Lateral rotation of thigh; anterior pelvic tilting under hyperlordosis',
    tkdRelevance: 'Responsible for the rapid chamber phase (bringing the knee high to the chest) for all kicks. Speed of hip flexion directly dictates kick chamber velocity.',
    primaryExercises: ['Hanging Leg Raises', 'Kettlebell Psoas March', 'Cable Knee Drives', 'Couch Stretch (Mobility)'],
    injuryRisks: 'Iliopsoas tendinopathy, snapping hip syndrome (coxa saltans), chronic shortening causing reciprocal inhibition of the glutes.',
    preventionTip: 'Perform dynamic hip flexor lengthening coupled with active glute activation to balance pelvic anterior-posterior tilt.',
    cameraFocus: {
      target: [0, -0.15, 0],
      distance: 2.0,
      recommendedView: 'front',
    },
  },

  // 6. ABS
  'Abs (Rectus Abdominis)': {
    id: 'Abs (Rectus Abdominis)',
    commonName: 'Rectus Abdominis',
    latinName: 'Musculus rectus abdominis',
    category: 'superficial_muscle',
    system: 'Muscular',
    origin: 'Pubic crest and pubic symphysis',
    insertion: 'Xiphoid process of sternum and costal cartilages of ribs 5–7',
    primaryAction: 'Trunk flexion, posterior pelvic tilt, intra-abdominal pressure generation',
    secondaryAction: 'Stabilizes the lumbar spine against hyperextension during high kicks',
    tkdRelevance: 'Locks the ribcage to the pelvis during impact, protecting internal organs and bracing against counter-strikes while maintaining kicking stability.',
    primaryExercises: ['Ab Wheel Rollouts', 'Hollow Body Holds', 'Dragon Flags', 'Pallof Presses'],
    injuryRisks: 'Rectus abdominis strain from sudden trunk hyperextension when pushed backwards while executing an off-balance kick.',
    preventionTip: 'Focus on anti-extension core exercises rather than repetitive spinal crunches.',
    cameraFocus: {
      target: [0, 0.15, 0],
      distance: 2.0,
      recommendedView: 'front',
    },
  },

  // 7. OBLIQUES
  'Obliques': {
    id: 'Obliques',
    commonName: 'Abdominal Obliques',
    latinName: 'Musculus obliquus externus & internus abdominis',
    category: 'superficial_muscle',
    system: 'Muscular',
    origin: 'External surfaces of ribs 5–12 (External); Iliac crest and thoracolumbar fascia (Internal)',
    insertion: 'Linea alba, pubic crest, anterior half of iliac crest (External); Inferior borders of ribs 10–12 (Internal)',
    primaryAction: 'Trunk rotation, lateral trunk flexion, abdominal compression',
    secondaryAction: 'Transfers kinetic energy between lower limbs and upper torso during spinning techniques',
    tkdRelevance: 'Generates rotational torque for spinning kicks (Dwit Dollyo Chagi, 360/540 spinning hook kicks) and anchors the torso in side kicks (Yop Chagi).',
    primaryExercises: ['Rotational Medicine Ball Slams', 'Russian Twists with Weight', 'Cable Woodchoppers', 'Side Planks with Rotations'],
    injuryRisks: 'Oblique muscle strains from violent unchecked torso twists during missed spinning strikes.',
    preventionTip: 'Train rotational deceleration using resisted elastic bands to strengthen eccentric rotational stopping power.',
    cameraFocus: {
      target: [0, 0.15, 0],
      distance: 2.0,
      recommendedView: 'front',
    },
  },

  // 8. LOWER BACK
  'Lower Back': {
    id: 'Lower Back',
    commonName: 'Lower Back (Erector Spinae & Quadratus Lumborum)',
    latinName: 'Musculus erector spinae (Iliocostalis, Longissimus, Spinalis) & Quadratus lumborum',
    category: 'deep_muscle',
    system: 'Muscular',
    origin: 'Thoracolumbar fascia, posterior crest of ilium, sacrum, and lumbar spinous processes',
    insertion: 'Ribs, thoracic/cervical transverse processes, and mastoid process of temporal bone',
    primaryAction: 'Spine extension, lateral flexion of spine, posture maintenance',
    secondaryAction: 'Absorbs shear forces and resists spinal flexion under heavy dynamic loads',
    tkdRelevance: 'Maintains upright torso integrity during high extension kicks; anchors the posterior chain in Dwit Chagi (Back Kick).',
    primaryExercises: ['Back Extensions (Hyperextensions)', 'Good Mornings', 'Bird-Dog Iso-Holds', 'Suitcase Carries'],
    injuryRisks: 'Lumbar facet joint irritation, disc herniation, or acute muscular spasm from excessive lumbar arching without core bracing.',
    preventionTip: 'Avoid excessive lumbar hyper-lordosis when aiming high; utilize hip extension rather than lower spine bending.',
    cameraFocus: {
      target: [0, 0.15, 0],
      distance: 2.0,
      recommendedView: 'back',
    },
  },

  // 9. CHEST
  'Chest (Pectorals)': {
    id: 'Chest (Pectorals)',
    commonName: 'Pectoralis Major',
    latinName: 'Musculus pectoralis major',
    category: 'superficial_muscle',
    system: 'Muscular',
    origin: 'Clavicular head (medial clavicle) & Sternocostal head (sternum and costal cartilages 1–6)',
    insertion: 'Lateral lip of bicipital groove of humerus',
    primaryAction: 'Arm adduction, medial rotation of arm, horizontal shoulder adduction',
    secondaryAction: 'Arm flexion (clavicular head); helps depress shoulder girdle',
    tkdRelevance: 'Powers straight punches (Momtong Jireugi), inside blocks (Momtong An Makki), and close-quarter hand strikes.',
    primaryExercises: ['Barbell/Dumbbell Bench Press', 'Weighted Push-ups', 'Incline Cable Flyes', 'Pec Minor Stretch'],
    injuryRisks: 'Pectoralis tendon rupture during heavy bench pressing; postural round shoulders pulling on the rotator cuff.',
    preventionTip: 'Balance chest training with equal volume of posterior upper back rowing and external rotator cuff drills.',
    cameraFocus: {
      target: [0, 0.45, 0],
      distance: 2.0,
      recommendedView: 'front',
    },
  },

  // 10. SHOULDERS
  'Shoulders (Deltoids)': {
    id: 'Shoulders (Deltoids)',
    commonName: 'Deltoids',
    latinName: 'Musculus deltoideus (Anterior, Lateral, Posterior heads)',
    category: 'superficial_muscle',
    system: 'Muscular',
    origin: 'Lateral third of clavicle, acromion, and spine of scapula',
    insertion: 'Deltoid tuberosity of humerus',
    primaryAction: 'Arm abduction (lateral head), arm flexion and internal rotation (anterior), arm extension and external rotation (posterior)',
    secondaryAction: 'Stabilizes the glenohumeral joint against downward displacement',
    tkdRelevance: 'Keeps high guard hands raised to shield the head; executes high blocks (Olgul Makki) and knife-hand strikes (Sonnal Mok Chigi).',
    primaryExercises: ['Overhead Military Press', 'Dumbbell Lateral Raises', 'Face Pulls with External Rotation', 'Arnold Presses'],
    injuryRisks: 'Subacromial impingement, anterior deltoid overuse, and rotator cuff conflict.',
    preventionTip: 'Strengthen the lower trapezius and serratus anterior to ensure proper scapular upward rotation during overhead movements.',
    cameraFocus: {
      target: [0, 0.55, 0],
      distance: 2.0,
      recommendedView: 'front',
    },
  },

  // 11. BACK (LATS)
  'Back (Lats)': {
    id: 'Back (Lats)',
    commonName: 'Latissimus Dorsi',
    latinName: 'Musculus latissimus dorsi',
    category: 'superficial_muscle',
    system: 'Muscular',
    origin: 'Spinous processes of T7–L5, thoracolumbar fascia, iliac crest, and inferior 3–4 ribs',
    insertion: 'Floor of intertubercular sulcus of humerus',
    primaryAction: 'Arm extension, adduction, and internal rotation; pulls shoulder down and back',
    secondaryAction: 'Assists in deep breathing and lateral trunk flexion',
    tkdRelevance: 'Creates powerful snapping retraction of the non-striking fist to the hip (Reaction Hand / Danggyeo Jireugi).',
    primaryExercises: ['Pull-ups / Chin-ups', 'Chest-Supported Barbell Rows', 'Single-Arm Dumbbell Rows', 'Lat Pulldowns'],
    injuryRisks: 'Latissimus strain during ballistic pulling motions; tightness restricting overhead mobility.',
    preventionTip: 'Maintain thoracic mobility with foam rolling and active overhead wall-slides.',
    cameraFocus: {
      target: [0, 0.45, 0],
      distance: 2.2,
      recommendedView: 'back',
    },
  },

  // 12. TRAPEZIUS
  'Trapezius': {
    id: 'Trapezius',
    commonName: 'Trapezius',
    latinName: 'Musculus trapezius (Superior, Middle, Inferior parts)',
    category: 'superficial_muscle',
    system: 'Muscular',
    origin: 'External occipital protuberance, nuchal ligament, and spinous processes of C7–T12',
    insertion: 'Lateral clavicle, acromion, and spine of scapula',
    primaryAction: 'Scapular elevation and upward rotation (upper); scapular retraction (middle); scapular depression (lower)',
    secondaryAction: 'Cervical spine extension and lateral flexion',
    tkdRelevance: 'Protects the neck against whiplash and head strikes during sparring; stabilizes scapular platform for all hand techniques.',
    primaryExercises: ['Barbell Shrugs', 'Prone Y-T-W Scapular Raises', 'Overhead Farmer Carries', 'Band Pull-Aparts'],
    injuryRisks: 'Upper trapezius hypertonicity and tension headaches from chronic stress or hunched fighting posture.',
    preventionTip: 'Prioritize lower trapezius and serratus activation drills to avoid dominant upper trapezius shrugging compensation.',
    cameraFocus: {
      target: [0, 0.65, 0],
      distance: 1.8,
      recommendedView: 'back',
    },
  },

  // 13. BICEPS
  'Biceps': {
    id: 'Biceps',
    commonName: 'Biceps Brachii',
    latinName: 'Musculus biceps brachii (Caput longum & Caput breve)',
    category: 'superficial_muscle',
    system: 'Muscular',
    origin: 'Supraglenoid tubercle of scapula (Long head); Coracoid process of scapula (Short head)',
    insertion: 'Radial tuberosity and bicipital aponeurosis into deep forearm fascia',
    primaryAction: 'Forearm supination, elbow flexion; assists weak shoulder flexion',
    secondaryAction: 'Anterior shoulder stability resisting humeral anterior glide',
    tkdRelevance: 'Essential for maintaining tight elbow guard defense against body kicks and hook punches.',
    primaryExercises: ['Incline Dumbbell Bicep Curls', 'Standing Barbell Curls', 'Hammer Curls for Brachialis', 'Chin-ups'],
    injuryRisks: 'Distal biceps tendon rupture from sudden violent eccentric loading; proximal long-head tendonitis.',
    preventionTip: 'Avoid sudden hyperextension of loaded elbow joints; perform regular forearm and bicep stretching.',
    cameraFocus: {
      target: [0, 0.4, 0],
      distance: 1.9,
      recommendedView: 'front',
    },
  },

  // 14. TRICEPS
  'Triceps': {
    id: 'Triceps',
    commonName: 'Triceps Brachii',
    latinName: 'Musculus triceps brachii (Long, Lateral, and Medial heads)',
    category: 'superficial_muscle',
    system: 'Muscular',
    origin: 'Infraglenoid tubercle of scapula (Long head); Posterior humerus above & below radial groove (Lateral/Medial)',
    insertion: 'Olecranon process of ulna',
    primaryAction: 'Forearm (elbow) extension; long head assists shoulder adduction and extension',
    secondaryAction: 'Resists elbow dislocation during heavy impact and push-off',
    tkdRelevance: 'Provides lockout snap in straight punches (Jireugi), palm strikes (Batangson Chigi), and push blocks.',
    primaryExercises: ['Close-Grip Bench Press', 'Parallel Bar Dips', 'Overhead Tricep Rope Extensions', 'Skull Crushers'],
    injuryRisks: 'Triceps tendinopathy at olecranon insertion; elbow hyperextension impingement.',
    preventionTip: 'Do not forcefully hyperextend (lock out) the elbow joint at the completion of full-speed punches into thin air.',
    cameraFocus: {
      target: [0, 0.4, 0],
      distance: 1.9,
      recommendedView: 'back',
    },
  },

  // 15. FOREARMS
  'Forearms': {
    id: 'Forearms',
    commonName: 'Forearm Flexors & Extensors',
    latinName: 'Musculi antebrachii (Brachioradialis, Pronator teres, Flexor/Extensor carpi group)',
    category: 'superficial_muscle',
    system: 'Muscular',
    origin: 'Medial epicondyle of humerus (Flexor common origin); Lateral epicondyle of humerus (Extensor common origin)',
    insertion: 'Metacarpal bases, phalanges, and carpal bones of hand',
    primaryAction: 'Wrist flexion, wrist extension, radial and ulnar deviation, pronation/supination, grip strength',
    secondaryAction: 'Protects the wrist joint from buckling upon solid punch impact',
    tkdRelevance: 'Crucial for knife hand (Sonnal), spear hand (Pyeonsonkeut), solid fist alignment, and bone-conditioning forearm blocks (Bakkat Makki).',
    primaryExercises: ['Wrist Roller Extensions', 'Farmer Walk Carries', 'Reverse Barbell Curls', 'Rice Bucket Hand Drills'],
    injuryRisks: 'Medial epicondylitis (Golfer elbow), lateral epicondylitis (Tennis elbow), wrist sprains from misaligned fist contact.',
    preventionTip: 'Keep wrist straight and locked in neutral alignment with forearm when punching heavy bags.',
    cameraFocus: {
      target: [0, 0.25, 0],
      distance: 1.8,
      recommendedView: 'front',
    },
  },

  // 16. TIBIALIS ANTERIOR
  'Tibialis Anterior': {
    id: 'Tibialis Anterior',
    commonName: 'Tibialis Anterior',
    latinName: 'Musculus tibialis anterior',
    category: 'superficial_muscle',
    system: 'Muscular',
    origin: 'Lateral condyle and upper 2/3 of lateral surface of tibia, interosseous membrane',
    insertion: 'Medial cuneiform and base of first metatarsal bone of foot',
    primaryAction: 'Dorsiflexion of foot at ankle joint; inversion of foot',
    secondaryAction: 'Dynamic medial longitudinal arch support during footstrike',
    tkdRelevance: 'Pulls the toes and ankle back during front kicks (Ap Chagi) to expose the ball of the foot (Apchuk) for clean impact without breaking toes.',
    primaryExercises: ['Tibialis Anterior Wall Raises', 'Kettlebell Toe Lifts', 'Reverse Slant Board Walks', 'Heel Walking Drills'],
    injuryRisks: 'Medial tibial stress syndrome (Shin Splints) and compartment syndrome from high-volume jumping on hard dojang floors.',
    preventionTip: 'Strengthen tibialis with isolated dorsiflexion reps and ensure proper shock-absorbing mats during plyometric training.',
    cameraFocus: {
      target: [0, -0.75, 0],
      distance: 1.8,
      recommendedView: 'front',
    },
  },

  // 17. ACHILLES TENDON
  'Achilles Tendon': {
    id: 'Achilles Tendon',
    commonName: 'Achilles Tendon',
    latinName: 'Tendo calcaneus',
    category: 'tendon_ligament',
    system: 'Connective',
    origin: 'Confluence of gastrocnemius and soleus muscle bellies in lower calf',
    insertion: 'Posterior surface of calcaneus bone (heel)',
    primaryAction: 'Transmits triceps surae contraction to calcaneus, creating plantar flexion leverage',
    secondaryAction: 'Stores and releases vast elastic strain energy during running, bouncing, and jumping',
    tkdRelevance: 'Undergoes extreme rotational torsional stress during the pivot on the supporting foot in roundhouse, side, and hook kicks.',
    primaryExercises: ['Isometric Heel Holds', 'Eccentric Heel Drops off Step', 'Progressive Plyometrics'],
    injuryRisks: 'Achilles tendinopathy, micro-tearing, and catastrophic rupture during explosive acceleration from stationary stance.',
    preventionTip: 'Warm up ankles with rotational circles and avoid sudden increases in barefoot high-impact plyometrics.',
    cameraFocus: {
      target: [0, -0.85, 0],
      distance: 1.6,
      recommendedView: 'back',
    },
  },

  // 18. PATELLAR TENDON
  'Patellar Tendon': {
    id: 'Patellar Tendon',
    commonName: 'Patellar Tendon & Ligament',
    latinName: 'Ligamentum patellae',
    category: 'tendon_ligament',
    system: 'Connective',
    origin: 'Apex and inferior border of patella (kneecap)',
    insertion: 'Tibial tuberosity of anterior tibia',
    primaryAction: 'Transfers quadriceps muscle contraction forces directly to the shin to extend the knee',
    secondaryAction: 'Maintains patellofemoral joint stability under deep knee flexion',
    tkdRelevance: 'Absorbs violent deceleration snap forces at the end-range extension of Ap Chagi and Dollyo Chagi kicks.',
    primaryExercises: ['Spanish Squats', 'Decline Board Isometric Squats', 'Slow Eccentric Leg Extensions'],
    injuryRisks: 'Patellar tendinitis ("Jumper Knee"), patellofemoral pain syndrome from repeated hyperextension.',
    preventionTip: 'Never snap kicks into empty air with full unchecked velocity; recruit hamstrings to eccentrically decelerate the strike.',
    cameraFocus: {
      target: [0, -0.5, 0],
      distance: 1.8,
      recommendedView: 'front',
    },
  },

  // 19. ROTATOR CUFF
  'Rotator Cuff Tendons': {
    id: 'Rotator Cuff Tendons',
    commonName: 'Rotator Cuff Tendons',
    latinName: 'Tendines musculorum rotatorum (Supraspinatus, Infraspinatus, Teres minor, Subscapularis)',
    category: 'tendon_ligament',
    system: 'Connective',
    origin: 'Supraspinous, infraspinous, and subscapular fossae of scapula',
    insertion: 'Greater and lesser tubercles of proximal humerus',
    primaryAction: 'Dynamic stabilization of humeral head inside shallow glenoid fossa during arm motions',
    secondaryAction: 'Internal and external glenohumeral rotation',
    tkdRelevance: 'Stabilizes shoulder during violent snapping blocks (Momtong Makki) and high-speed punch decelerations.',
    primaryExercises: ['Side-Lying External Rotations', 'Cable Face Pulls with External Rotation', 'Sleeper Stretch'],
    injuryRisks: 'Supraspinatus tendon impingement under acromion, labral fraying, and overuse tendonitis.',
    preventionTip: 'Maintain 2:1 pulling to pushing ratio to keep humeral head centered in glenoid cavity.',
    cameraFocus: {
      target: [0, 0.55, 0],
      distance: 1.8,
      recommendedView: 'back',
    },
  },

  // 20. SKELETON
  'Skeletal System': {
    id: 'Skeletal System',
    commonName: 'Articulated Human Skeleton',
    latinName: 'Systema skeletale (Cranium, Columna vertebralis, Thorax, Pelvis, Ossa extremitatum)',
    category: 'skeletal_structure',
    system: 'Skeletal',
    origin: 'Axial skeleton and appendicular skeletal framework',
    insertion: 'Point of origin and insertion for all 600+ skeletal muscles',
    primaryAction: 'Structural support, biomechanical lever transmission, internal organ protection, mineral storage',
    secondaryAction: 'Provides joint articulation axes (hinge, ball-and-socket, pivot, condyloid)',
    tkdRelevance: 'Bone density increases through Wolff Law from repeated impact conditioning (forearm blocks, shin conditioning).',
    primaryExercises: ['Heavy Compound Resistance Training', 'High-Impact Plyometrics', 'Bone Conditioning on Padded Targets'],
    injuryRisks: 'Stress fractures in metatarsals and shin bones; traumatic joint dislocations.',
    preventionTip: 'Ensure adequate calcium, vitamin D3, and progressive load periodization to allow bone remodeling cycles.',
    cameraFocus: {
      target: [0, 0, 0],
      distance: 3.5,
      recommendedView: 'front',
    },
  },

  // 21. ADDUCTORS (INNER THIGHS)
  'Adductors (Inner Thighs)': {
    id: 'Adductors (Inner Thighs)',
    commonName: 'Hip Adductors & Gracilis',
    latinName: 'Musculi adductores femoris (Adductor longus, magnus, brevis, Gracilis, Pectineus)',
    category: 'superficial_muscle',
    system: 'Muscular',
    origin: 'Pubic body and inferior pubic ramus; Ischial tuberosity (adductor magnus)',
    insertion: 'Linea aspera of femur; Pes anserinus of medial tibia (Gracilis)',
    primaryAction: 'Hip adduction, thigh flexion assistance, pelvic stabilization in single-leg stance',
    secondaryAction: 'Medial rotation of the thigh; stabilizes the knee against valgus collapse',
    tkdRelevance: 'Powers the rapid return chamber after high kicking (Dollyo Chagi, Yop Chagi); anchors the rock-solid base in Horse Riding Stance (Juchum Seogi).',
    primaryExercises: ['Copenhagen Adductor Planks', 'Cable Hip Adductions', 'Sumo Squats', 'Lateral Cossack Lunges'],
    injuryRisks: 'Groin pull / adductor strain during sudden ballistic lateral kicks without thorough dynamic hip opening.',
    preventionTip: 'Perform progressive eccentric groin strengthening and dynamic butterfly stretches before ballistic sparring.',
    cameraFocus: {
      target: [0, -0.35, 0],
      distance: 2.0,
      recommendedView: 'front',
    },
  },

  // 22. SERRATUS ANTERIOR
  'Serratus Anterior': {
    id: 'Serratus Anterior',
    commonName: "Serratus Anterior (The Boxer's Muscle)",
    latinName: 'Musculus serratus anterior',
    category: 'superficial_muscle',
    system: 'Muscular',
    origin: 'Outer lateral surfaces of upper 8 to 9 ribs',
    insertion: 'Costal surface of medial border of scapula',
    primaryAction: 'Scapular protraction (punch reach), upward rotation of scapula during arm elevation',
    secondaryAction: 'Holds scapula firmly against thoracic ribcage, preventing winging',
    tkdRelevance: 'Provides the explosive terminal snap and maximum extension range in punches (Jireugi) and stabilizes overhead blocks (Olgul Makki).',
    primaryExercises: ['Push-up Plus', 'Serratus Cable Punches', 'Overhead Dumbbell Shrugs', 'Bear Crawls'],
    injuryRisks: 'Scapular winging, long thoracic nerve irritation, and loss of punching stability.',
    preventionTip: 'Incorporate protraction push-up plus variations to prevent shoulder blade detachment from the ribcage.',
    cameraFocus: {
      target: [0, 0.35, 0],
      distance: 2.0,
      recommendedView: 'front',
    },
  },
};

export const TKD_KICK_PRESETS = {
  'Ap Chagi (Front Kick)': {
    name: 'Ap Chagi (Front Kick)',
    koreanName: '앞차기',
    description: 'Linear snapping kick driven by high hip flexion chamber and rapid knee extension snap.',
    targetZone: 'Solar plexus, chin, or jaw',
    activatedMuscles: {
      'Quadriceps': 0.95,
      'Hip Flexors': 0.90,
      'Abs (Rectus Abdominis)': 0.65,
      'Tibialis Anterior': 0.85,
      'Calves': 0.45,
      'Glutes': 0.35,
    },
    strainedTendons: {
      'Patellar Tendon': 'High (95% extension snap tension)',
      'Achilles Tendon': 'Moderate (45% stance stabilization)',
      'Hip Flexor Tendon': 'High (88% chamber acceleration)',
    },
    clinicalNotes: 'Hamstrings must actively fire to brake the knee joint at terminal extension, preventing patellar hyperextension trauma.',
  },
  'Dollyo Chagi (Roundhouse Kick)': {
    name: 'Dollyo Chagi (Roundhouse Kick)',
    koreanName: '돌려차기',
    description: 'Rotational whipping kick leveraging pelvic torque, supporting leg pivot, and whip snap.',
    targetZone: 'Ribs, temple, or neck',
    activatedMuscles: {
      'Glutes': 0.95,
      'Obliques': 0.90,
      'Quadriceps': 0.80,
      'Hamstrings': 0.70,
      'Calves': 0.85,
      'Hip Flexors': 0.60,
    },
    strainedTendons: {
      'Achilles Tendon': 'Critical (95% pivot torque on support foot)',
      'Patellar Tendon': 'High (78% snapping whip)',
      'Rotator Cuff Tendons': 'Moderate (50% counter-balance guard)',
    },
    clinicalNotes: 'Ensure 180-degree pivot of support heel toward target to prevent medial collateral ligament (MCL) shear on support knee.',
  },
  'Yop Chagi (Side Kick)': {
    name: 'Yop Chagi (Side Kick)',
    koreanName: '옆차기',
    description: 'Linear thrusting power kick driving the heel along an arrow-straight line with locked hip and knee.',
    targetZone: 'Solar plexus, ribs, or head',
    activatedMuscles: {
      'Glutes': 1.00,
      'Obliques': 0.88,
      'Hamstrings': 0.82,
      'Calves': 0.90,
      'Lower Back': 0.75,
      'Quadriceps': 0.65,
    },
    strainedTendons: {
      'Achilles Tendon': 'High (90% stance thrust resistance)',
      'Patellar Tendon': 'Moderate (65% lockout stability)',
      'Hip Flexor Tendon': 'High (80% chamber compression)',
    },
    clinicalNotes: 'Gluteus medius conditioning is vital for single-leg lateral stability and preventing torso drop.',
  },
  'Dwit Chagi (Back Kick)': {
    name: 'Dwit Chagi (Back Kick)',
    koreanName: '뒤차기',
    description: 'Linear rear thrust utilizing the full posterior chain for maximum stopping force.',
    targetZone: 'Sternum, solar plexus, or liver',
    activatedMuscles: {
      'Glutes': 1.00,
      'Hamstrings': 0.95,
      'Lower Back': 0.85,
      'Calves': 0.70,
      'Quadriceps': 0.45,
    },
    strainedTendons: {
      'Hamstring Tendons': 'Critical (96% posterior drive tension)',
      'Achilles Tendon': 'High (75% floor push-off)',
      'Patellar Tendon': 'Low (40% extension load)',
    },
    clinicalNotes: 'Thorough lower back and glute warm-up required. Drive backward from the heel without excessive spinal hyperextension.',
  },
};
