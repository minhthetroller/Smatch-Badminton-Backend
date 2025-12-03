/**
 * Autocomplete suggestion returned from Redis
 */
export interface AutocompleteSuggestion {
  /** Court UUID */
  id: string;
  /** Matched search term (court name) */
  text: string;
  /** Popularity/relevance score */
  score: number;
  /** Combined address string (optional, when includeDetails=true) */
  address?: string;
  /** Latitude coordinate (optional, when includeDetails=true) */
  latitude?: number;
  /** Longitude coordinate (optional, when includeDetails=true) */
  longitude?: number;
}

/**
 * Query parameters for autocomplete endpoint
 */
export interface AutocompleteQueryParams {
  /** Search prefix (minimum 2 characters) */
  q: string;
  /** Maximum number of results (default: 10, max: 20) */
  limit?: number;
  /** Include address and geolocation in response (default: false) */
  includeDetails?: boolean;
}

/**
 * Court details for autocomplete (fetched from database when includeDetails=true)
 */
export interface CourtAutocompleteDetails {
  id: string;
  addressStreet: string | null;
  addressWard: string | null;
  addressDistrict: string | null;
  addressCity: string | null;
  latitude: number | null;
  longitude: number | null;
}

/**
 * Query parameters for full search endpoint
 */
export interface SearchQueryParams {
  /** Search query string */
  q: string;
  /** Page number (default: 1) */
  page?: number;
  /** Results per page (default: 10, max: 50) */
  limit?: number;
  /** Minimum similarity threshold (default: 0.3) */
  minSimilarity?: number;
  /** Filter by district */
  district?: string;
}

/**
 * Court search result with similarity scores
 */
export interface CourtSearchResult {
  id: string;
  name: string;
  addressDistrict: string | null;
  addressCity: string | null;
  addressWard: string | null;
  addressStreet: string | null;
  /** Similarity score for name match (0-1) */
  nameScore: number;
  /** Similarity score for district match (0-1) */
  districtScore: number;
}

/**
 * Raw result from PostgreSQL search query
 */
export interface RawCourtSearchResult {
  id: string;
  name: string;
  address_district: string | null;
  address_city: string | null;
  address_ward: string | null;
  address_street: string | null;
  name_score: number;
  district_score: number;
}

/**
 * Paginated search response
 */
export interface SearchResultsResponse {
  courts: CourtSearchResult[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Court data for indexing in autocomplete
 */
export interface CourtIndexData {
  id: string;
  name: string;
  addressDistrict: string | null;
  addressWard: string | null;
  addressCity: string | null;
}

