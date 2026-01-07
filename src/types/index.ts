export * from './court.types.js';
export * from './availability.types.js';
export * from './payment.types.js';
export * from './search.types.js';
export * from './auth.types.js';
export * from './match.types.js';
export * from './notification.types.js';

// Opening hours type for court
export interface OpeningHours {
  mon?: string;
  tue?: string;
  wed?: string;
  thu?: string;
  fri?: string;
  sat?: string;
  sun?: string;
}

