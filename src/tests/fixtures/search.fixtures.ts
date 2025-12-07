/**
 * Test fixtures for search functionality
 * Contains sample data and payloads for search-related tests
 */

import type {
  AutocompleteSuggestion,
  CourtSearchResult,
  SearchResultsResponse,
  CourtIndexData,
  CourtAutocompleteDetails,
} from '../../types/index.js';

// ==================== SAMPLE COURT DATA ====================

export const sampleCourtForIndex: CourtIndexData = {
  id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  name: 'Sân Cầu Lông Ngọc Khánh',
  addressDistrict: 'Quận Ba Đình',
  addressWard: 'Phường Ngọc Khánh',
  addressCity: 'Hà Nội',
};

export const sampleCourtsForIndex: CourtIndexData[] = [
  sampleCourtForIndex,
  {
    id: 'b1ffcd00-0d1c-5fg9-cc7e-7cc0ce491b22',
    name: 'Sân Cầu Lông Hoàn Kiếm',
    addressDistrict: 'Quận Hoàn Kiếm',
    addressWard: 'Phường Hàng Bạc',
    addressCity: 'Hà Nội',
  },
  {
    id: 'c2ggde11-1e2d-6gh0-dd8f-8dd1df502c33',
    name: 'Badminton Court Long Biên',
    addressDistrict: 'Quận Long Biên',
    addressWard: 'Phường Ngọc Lâm',
    addressCity: 'Hà Nội',
  },
  {
    id: 'd3hhef22-2f3e-7hi1-ee9g-9ee2eg613d44',
    name: 'Sân Cầu Lông Mai Dịch',
    addressDistrict: 'Quận Cầu Giấy',
    addressWard: 'Phường Mai Dịch',
    addressCity: 'Hà Nội',
  },
];

// ==================== AUTOCOMPLETE SUGGESTIONS ====================

export const sampleAutocompleteSuggestions: AutocompleteSuggestion[] = [
  {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    text: 'Sân Cầu Lông Ngọc Khánh',
    score: 100,
  },
  {
    id: 'b1ffcd00-0d1c-5fg9-cc7e-7cc0ce491b22',
    text: 'Sân Cầu Lông Hoàn Kiếm',
    score: 95,
  },
  {
    id: 'd3hhef22-2f3e-7hi1-ee9g-9ee2eg613d44',
    text: 'Sân Cầu Lông Mai Dịch',
    score: 90,
  },
];

// Autocomplete suggestions with details (when includeDetails=true)
export const sampleAutocompleteSuggestionsWithDetails: AutocompleteSuggestion[] = [
  {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    text: 'Sân Cầu Lông Ngọc Khánh',
    score: 100,
    address: '123 Đường Ngọc Khánh, Phường Ngọc Khánh, Quận Ba Đình, Hà Nội',
    latitude: 21.0285,
    longitude: 105.8542,
  },
  {
    id: 'b1ffcd00-0d1c-5fg9-cc7e-7cc0ce491b22',
    text: 'Sân Cầu Lông Hoàn Kiếm',
    score: 95,
    address: '45 Đường Hàng Bạc, Phường Hàng Bạc, Quận Hoàn Kiếm, Hà Nội',
    latitude: 21.0333,
    longitude: 105.8500,
  },
  {
    id: 'd3hhef22-2f3e-7hi1-ee9g-9ee2eg613d44',
    text: 'Sân Cầu Lông Mai Dịch',
    score: 90,
    address: 'Phường Mai Dịch, Quận Cầu Giấy, Hà Nội',
    latitude: 21.0400,
    longitude: 105.7800,
  },
];

// ==================== COURT AUTOCOMPLETE DETAILS ====================

export const sampleCourtAutocompleteDetails: CourtAutocompleteDetails[] = [
  {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    addressStreet: '123 Đường Ngọc Khánh',
    addressWard: 'Phường Ngọc Khánh',
    addressDistrict: 'Quận Ba Đình',
    addressCity: 'Hà Nội',
    latitude: 21.0285,
    longitude: 105.8542,
  },
  {
    id: 'b1ffcd00-0d1c-5fg9-cc7e-7cc0ce491b22',
    addressStreet: '45 Đường Hàng Bạc',
    addressWard: 'Phường Hàng Bạc',
    addressDistrict: 'Quận Hoàn Kiếm',
    addressCity: 'Hà Nội',
    latitude: 21.0333,
    longitude: 105.8500,
  },
  {
    id: 'd3hhef22-2f3e-7hi1-ee9g-9ee2eg613d44',
    addressStreet: null,
    addressWard: 'Phường Mai Dịch',
    addressDistrict: 'Quận Cầu Giấy',
    addressCity: 'Hà Nội',
    latitude: 21.0400,
    longitude: 105.7800,
  },
];

// Court details without geolocation
export const sampleCourtDetailsNoLocation: CourtAutocompleteDetails = {
  id: 'e4iifg33-3g4f-8ij2-ff0h-0ff3fh724e55',
  addressStreet: '789 Đường Test',
  addressWard: 'Phường Test',
  addressDistrict: 'Quận Test',
  addressCity: 'Hà Nội',
  latitude: null,
  longitude: null,
};

// ==================== SEARCH RESULTS ====================

export const sampleSearchResult: CourtSearchResult = {
  id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  name: 'Sân Cầu Lông Ngọc Khánh',
  addressDistrict: 'Quận Ba Đình',
  addressCity: 'Hà Nội',
  addressWard: 'Phường Ngọc Khánh',
  addressStreet: '123 Đường Ngọc Khánh',
  nameScore: 0.85,
  districtScore: 0.75,
};

export const sampleSearchResults: CourtSearchResult[] = [
  sampleSearchResult,
  {
    id: 'b1ffcd00-0d1c-5fg9-cc7e-7cc0ce491b22',
    name: 'Sân Cầu Lông Hoàn Kiếm',
    addressDistrict: 'Quận Hoàn Kiếm',
    addressCity: 'Hà Nội',
    addressWard: 'Phường Hàng Bạc',
    addressStreet: '45 Đường Hàng Bạc',
    nameScore: 0.82,
    districtScore: 0.70,
  },
];

export const sampleSearchResponse: SearchResultsResponse = {
  courts: sampleSearchResults,
  total: 2,
  page: 1,
  limit: 10,
  totalPages: 1,
};

export const emptySearchResponse: SearchResultsResponse = {
  courts: [],
  total: 0,
  page: 1,
  limit: 10,
  totalPages: 0,
};

// ==================== VALID SEARCH QUERIES ====================

export const validSearchQueries = {
  basic: 'cầu lông',
  singleWord: 'badminton',
  vietnamese: 'Ngọc Khánh',
  vietnameseUnaccented: 'ngoc khanh',
  mixedCase: 'CầU LôNG',
  withDistrict: 'cầu lông ba đình',
  multiWord: 'san cau long',
  englishTerm: 'badminton court',
  minLength: 'ab',
};

// ==================== EDGE CASE QUERIES ====================

export const edgeCaseQueries = {
  singleChar: 'a',
  emptyString: '',
  whitespaceOnly: '   ',
  leadingWhitespace: '   cầu lông',
  trailingWhitespace: 'cầu lông   ',
  multipleSpaces: 'cầu    lông',
  numbersOnly: '12345',
  specialCharsOnly: '!@#$%',
  mixedSpecialChars: 'cầu lông @#$',
  veryLongQuery: 'a'.repeat(500),
  unicodeEmoji: 'cầu lông 🏸',
  newlines: 'cầu\nlông',
  tabs: 'cầu\tlông',
  mixedAlphanumeric: 'cầu lông 123',
};

// ==================== INVALID PAGINATION ====================

export const invalidPaginationParams = {
  negativePage: -1,
  zeroPage: 0,
  negativeLimit: -10,
  zeroLimit: 0,
  exceedsMaxLimit: 1000,
  stringPage: 'abc',
  stringLimit: 'xyz',
  floatPage: 1.5,
  floatLimit: 10.7,
  maxIntPage: Number.MAX_SAFE_INTEGER,
  infinityLimit: Infinity,
  nanPage: NaN,
};

// ==================== SEARCH SECURITY PAYLOADS ====================

export const searchXssPayloads = {
  scriptInQuery: '<script>alert("xss")</script>',
  imgOnerrorInQuery: '<img src="x" onerror="alert(1)">',
  svgOnloadInQuery: '<svg onload="alert(1)">',
  javascriptUrl: 'javascript:alert(1)',
  encodedScript: '%3Cscript%3Ealert(1)%3C/script%3E',
  unicodeScript: '\u003cscript\u003ealert(1)\u003c/script\u003e',
  nestedHtml: '<div><script>alert(1)</script></div>',
  eventHandler: '" onmouseover="alert(1)" x="',
  dataUri: 'data:text/html,<script>alert(1)</script>',
};

export const searchSqlInjectionPayloads = {
  basicOr: "' OR '1'='1",
  unionSelect: "' UNION SELECT * FROM users --",
  dropTable: "'; DROP TABLE courts; --",
  commentDash: "admin'--",
  blindTime: "'; SELECT pg_sleep(5); --",
  informationSchema: "' UNION SELECT table_name FROM information_schema.tables --",
  stackedQuery: "'; INSERT INTO courts (name) VALUES ('hacked'); --",
  quotesEscape: "cầu lông'; --",
  doubleQuotes: 'cầu lông"; --',
  backslashEscape: "cầu lông\\'; --",
  hexEncoded: '0x27204f5220273127273d2731',
  charFunction: "CHAR(39)+OR+CHAR(39)1CHAR(39)=CHAR(39)1",
};

export const searchNoSqlPayloads = {
  gtOperator: '{"$gt": ""}',
  neOperator: '{"$ne": null}',
  whereOperator: '{"$where": "1==1"}',
  regexOperator: '{"$regex": ".*"}',
  jsonBreaking: '{"key": "value"}',
};

export const searchPathTraversalPayloads = {
  basicTraversal: '../../../etc/passwd',
  urlEncoded: '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
  nullByte: '../../../etc/passwd%00',
  windowsPath: '..\\..\\..\\windows\\system32',
};

export const searchCommandInjectionPayloads = {
  semicolon: 'cầu lông; cat /etc/passwd',
  pipe: 'cầu lông | cat /etc/passwd',
  backticks: 'cầu lông `cat /etc/passwd`',
  dollarParen: 'cầu lông $(cat /etc/passwd)',
  ampersand: 'cầu lông && cat /etc/passwd',
  newlineCmd: 'cầu lông\ncat /etc/passwd',
};

// ==================== VIETNAMESE-SPECIFIC TEST CASES ====================

export const vietnameseTestCases = {
  // Tones/Diacritics
  noTone: 'cau long',
  withTone: 'cầu lông',
  mixedTone: 'cầu long',
  uppercaseWithTone: 'CẦU LÔNG',
  
  // Special Vietnamese characters
  dWithStroke: 'đường',
  oWithHorn: 'ở',
  aWithBreve: 'ă',
  eWithCircumflex: 'ê',
  
  // District names with diacritics
  districtBaDinh: 'Ba Đình',
  districtBaDinhUnaccented: 'ba dinh',
  districtHoanKiem: 'Hoàn Kiếm',
  districtHoanKiemUnaccented: 'hoan kiem',
  districtCauGiay: 'Cầu Giấy',
  districtCauGiayUnaccented: 'cau giay',
  
  // Common Vietnamese search terms
  san: 'sân',
  sanUnaccented: 'san',
  phuong: 'phường',
  phuongUnaccented: 'phuong',
  quan: 'quận',
  quanUnaccented: 'quan',
};

// ==================== RESPONSE VALIDATION HELPERS ====================

export const expectedResponseStructure = {
  autocomplete: {
    success: true,
    data: {
      suggestions: 'array',
    },
  },
  search: {
    success: true,
    data: 'array',
    meta: {
      pagination: {
        page: 'number',
        limit: 'number',
        total: 'number',
        totalPages: 'number',
      },
    },
  },
  popular: {
    success: true,
    data: {
      searches: 'array',
    },
  },
  stats: {
    success: true,
    data: {
      autocompleteCount: 'number',
      courtsCount: 'number',
    },
  },
  reindex: {
    success: true,
    data: {
      message: 'string',
      indexed: 'number',
      durationMs: 'number',
    },
  },
};

