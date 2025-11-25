export interface CourtDetails {
  amenities?: string[];
  payments?: string[];
  serviceOptions?: string[];
  highlights?: string[];
  [key: string]: unknown;
}

export interface OpeningHours {
  mon?: string;
  tue?: string;
  wed?: string;
  thu?: string;
  fri?: string;
  sat?: string;
  sun?: string;
}

export interface CourtLocation {
  latitude: number;
  longitude: number;
}

export interface CreateCourtDto {
  name: string;
  description?: string;
  phoneNumbers?: string[];
  addressStreet?: string;
  addressWard?: string;
  addressDistrict?: string;
  addressCity?: string;
  details?: CourtDetails;
  openingHours?: OpeningHours;
  location?: CourtLocation;
}

export interface UpdateCourtDto extends Partial<CreateCourtDto> {}

export interface CourtQueryParams {
  district?: string;
  page?: number;
  limit?: number;
}

