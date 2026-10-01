import React from 'react';

export const CAMBODIA_LOCATIONS: Record<string, string[]> = {
  "Phnom Penh": [
    "Chamkar Mon", "Boeng Keng Kang", "Chbar Ampov", "Chroy Changvar", 
    "Dangkor", "Daun Penh", "Kamboul", "Meanchey", "Prampir Makara", 
    "Prek Pnov", "Russey Keo", "Sen Sok", "Toul Kork"
  ],
  "Siem Reap": [
    "Siem Reap Municipality", "Prasat Bakong", "Banteay Srei", "Sotnikum",
    "Puok", "Chi Kreng", "Angkor Chum", "Angkor Thom", "Varin", "Svay Leu",
    "Kralanh", "Srei Snam"
  ],
  "Battambang": [
    "Battambang Municipality", "Sangkae", "Banan", "Ek Phnom", "Bavel",
    "Moung Ruessei", "Rukh Kiri", "Koas Krala", "Kamrieng", "Phnum Proek",
    "Sampov Loun", "Rotanak Mondol", "Thma Koul", "Samlout"
  ],
  "Kandal": [
    "Ta Khmau Municipality", "Kien Svay", "Sa'ang", "Koh Thom", "Ponhea Leu",
    "Muk Kampoul", "Lvea Aem", "Angk Snuol", "Kandal Stueng", "Khsach Kandal"
  ],
  "Kampong Cham": [
    "Kampong Cham Municipality", "Kampong Siem", "Kang Meas", "Koh Sotin",
    "Prey Chhor", "Batheay", "Chey Sen", "Chamkar Leu", "Stueng Trang", "Grei Bett"
  ],
  "Preah Sihanouk (Sihanoukville)": [
    "Sihanoukville Municipality", "Prey Nob", "Stueng Hav", "Kampong Seila", "Koh Rong Municipality"
  ],
  "Kampot": [
    "Kampot Municipality", "Tuek Chhou", "Kampong Trach", "Chhouk",
    "Banteay Meas", "Angkor Chey", "Dang Tong", "Bokor Municipality"
  ],
  "Takeo": [
    "Daun Keo Municipality", "Tram Kak", "Kirivong", "Bati", "Samraong",
    "Prey Kabbas", "Treang", "Koh Andaet", "Angkor Borei", "Bourei Cholsar"
  ],
  "Kampong Speu": [
    "Chbar Mon Municipality", "Samraong Tong", "Kong Pisei", "Basedth",
    "Phnom Sruoch", "Aoral", "Odongk Municipality", "Thpong"
  ],
  "Banteay Meanchey": [
    "Serei Saophoan Municipality", "Poipet Municipality", "Mongkol Borei",
    "Preah Netr Preah", "Phnum Srok", "Thma Pouk", "Malai", "Ou Chrov"
  ],
  "Kampong Thom": [
    "Stueng Saen Municipality", "Baray", "Santuk", "Kampong Svay",
    "Sandan", "Prasat Sambour", "Prasat Balangk", "Stoung"
  ],
  "Pursat": [
    "Pursat Municipality", "Kandieng", "Bakan", "Krakor", "Phnum Kravanh", "Veal Veang"
  ],
  "Prey Veng": [
    "Prey Veng Municipality", "Peam Ro", "Peam Chor", "Kamchay Mear",
    "Ba Phnum", "Kanhchriech", "Pea Reang", "Sithor Kandal", "Preah Sdach",
    "Svay Antor", "Mesang", "Kampong Trabaek"
  ],
  "Svay Rieng": [
    "Svay Rieng Municipality", "Bavet Municipality", "Chantrea",
    "Kampong Rou", "Rumduol", "Romeas Haek", "Svay Chrum", "Svay Teab"
  ],
  "Koh Kong": [
    "Khemarak Phoumin Municipality", "Srae Ambel", "Mondol Seima",
    "Koh Kong District", "Botum Sakor", "Thma Bang"
  ],
  "Kep": [
    "Kep Municipality", "Damnak Chang'aeur"
  ]
};

export function DataLists() {
  return (
    <>
      <datalist id="countries">
        <option value="Cambodia" />
        <option value="South Korea" />
        <option value="United States" />
        <option value="Thailand" />
        <option value="Vietnam" />
        <option value="Japan" />
        <option value="China" />
        <option value="Singapore" />
        <option value="Malaysia" />
        <option value="Philippines" />
        <option value="Indonesia" />
        <option value="Australia" />
        <option value="United Kingdom" />
        <option value="France" />
      </datalist>

      <datalist id="provinces">
        {Object.keys(CAMBODIA_LOCATIONS).map(prov => (
          <option key={prov} value={prov} />
        ))}
      </datalist>

      <datalist id="cities">
        {Object.values(CAMBODIA_LOCATIONS).flat().map(dist => (
          <option key={dist} value={dist} />
        ))}
      </datalist>
    </>
  );
}
