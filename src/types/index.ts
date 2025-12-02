export * from './court.types.js';
export * from './availability.types.js';
export * from './payment.types.js';

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

