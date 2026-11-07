// Standard categories based on WT and Fitness systems
export const TKD_CATEGORIES = [
  'Forms (Poomsae)',
  'Kicks (Chagi)',
  'Stances & Footwork (Seogi)',
  'Strikes (Jirugi/Chigi)',
  'Blocks (Makki)',
  'Sparring (Kyorugi)',
  'Breaking (Kyokpa)',
  'Self-Defense (Hosinsul)',
  'Tricking & Acrobatics',
  'Theory & Terminology'
] as const;
export const FITNESS_CATEGORIES = ['Strength', 'Explosive', 'Speed', 'Agility', 'Control', 'Balance', 'Flexibility', 'Functional', 'Rotational', 'Core', 'Conditioning'] as const;
export const DANCE_CATEGORIES = [
  'Dance: Hiphop',
  'Dance: Popping',
  'Dance: Tutorials',
  'Dance: Resources'
] as const;
export const ROUTINE_TYPES = [
  'Taekwondo Workout',
  'Fitness Workout',
  'Hybrid Training',
  'Weight Loss',
  'Full Body Strength',
  'Taekwondo Cardio',
  'Hiphop Dance Workout',
  'Taekwondo Aerobic'
] as const;
export const BELTS = ['All', 'White', 'Yellow', 'Green', 'Blue', 'Brown', 'Red', '1st Poom/Dan', '2nd Poom/Dan', '3rd Poom/Dan'] as const;

export const getBeltTranslationKey = (belt: string): any => {
  const b = belt.trim().toLowerCase();
  if (b.includes('white')) return 'belt_white';
  if (b.includes('yellow')) return 'belt_yellow';
  if (b.includes('green')) return 'belt_green';
  if (b.includes('blue')) return 'belt_blue';
  if (b.includes('brown')) return 'belt_brown';
  if (b.includes('red')) return 'belt_red';
  if (b.includes('1st')) return 'belt_1st_poom_dan';
  if (b.includes('2nd')) return 'belt_2nd_poom_dan';
  if (b.includes('3rd')) return 'belt_3rd_poom_dan';
  return 'belt_all';
};

