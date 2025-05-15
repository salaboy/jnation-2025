export type Location = {
  country: string;
  city: string;
  region: string;
  postal: string;
  timezone: string;
};

export const predefinedLocations: Location[] = [
  { country: 'Germany', city: 'Emden', region: 'Lower Saxony', postal: '26721', timezone: 'Europe/Berlin' },
  { country: 'Canada', city: 'Vancouver', region: 'British Columbia', postal: 'V6G 1A5', timezone: 'America/Vancouver' },
  { country: 'USA', city: 'Hawaii Volcanoes National Park', region: 'Hawaii', postal: '96718', timezone: 'Pacific/Honolulu' },
  { country: 'Russia', city: 'Dudinka', region: 'Krasnoyarsk Krai', postal: '647000', timezone: 'Asia/Krasnoyarsk' },
  { country: 'Egypt', city: 'Luxor', region: 'Nile Valley', postal: '85951', timezone: 'Africa/Cairo' }
];

export function getRandomLocation(): Location {
  const randomIndex = Math.floor(Math.random() * predefinedLocations.length);
  return predefinedLocations[randomIndex];
}
