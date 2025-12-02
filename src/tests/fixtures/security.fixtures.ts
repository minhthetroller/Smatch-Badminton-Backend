/**
 * Test fixtures for security testing
 * Contains various attack payloads for XSS, SQL Injection, etc.
 */

// ==================== XSS PAYLOADS ====================

export const xssPayloads = {
  // Basic script injection
  scriptTag: '<script>alert("xss")</script>',
  scriptTagVariant: '<SCRIPT>alert("xss")</SCRIPT>',
  scriptTagEncoded: '&lt;script&gt;alert("xss")&lt;/script&gt;',
  
  // Event handler injection
  imgOnerror: '<img src="x" onerror="alert(1)">',
  imgOnload: '<img src="valid.jpg" onload="alert(1)">',
  svgOnload: '<svg onload="alert(1)">',
  bodyOnload: '<body onload="alert(1)">',
  inputOnfocus: '<input onfocus="alert(1)" autofocus>',
  divOnmouseover: '<div onmouseover="alert(1)">hover me</div>',
  
  // URL-based XSS
  javascriptUrl: 'javascript:alert(1)',
  javascriptUrlEncoded: 'javascript%3Aalert(1)',
  dataUrl: 'data:text/html,<script>alert(1)</script>',
  
  // Attribute injection
  breakoutAttribute: '" onclick="alert(1)" data-x="',
  singleQuoteBreakout: "' onclick='alert(1)' data-x='",
  
  // Unicode/encoding tricks
  unicodeScript: '\u003cscript\u003ealert(1)\u003c/script\u003e',
  htmlEntityScript: '&#60;script&#62;alert(1)&#60;/script&#62;',
  
  // DOM-based XSS
  documentWrite: 'document.write("<script>alert(1)</script>")',
  innerHtml: 'element.innerHTML = "<img src=x onerror=alert(1)>"',
  
  // Framework-specific
  angularExpression: '{{constructor.constructor("alert(1)")()}}',
  vueExpression: '{{_c.constructor("alert(1)")()}}',
  
  // Mobile-specific (for mobile frontend)
  deepLink: 'app://malicious-deep-link',
  intentUrl: 'intent://malicious#Intent;end',
};

// ==================== SQL INJECTION PAYLOADS ====================

export const sqlInjectionPayloads = {
  // Basic injection
  basicOr: "' OR '1'='1",
  basicOrNumeric: '1 OR 1=1',
  basicUnion: "' UNION SELECT * FROM users --",
  
  // Comment-based
  commentDash: "admin'--",
  commentHash: "admin'#",
  commentSlash: "admin'/*",
  
  // Tautology
  tautology: "' OR 'x'='x",
  tautologyNumeric: '1=1',
  
  // DROP/DELETE attacks
  dropTable: "'; DROP TABLE courts; --",
  deleteAll: "'; DELETE FROM courts; --",
  truncateTable: "'; TRUNCATE TABLE courts; --",
  
  // Data extraction
  unionSelect: "' UNION SELECT id, name, description FROM courts --",
  unionSelectNull: "' UNION SELECT NULL, NULL, NULL --",
  informationSchema: "' UNION SELECT table_name FROM information_schema.tables --",
  
  // Blind injection
  blindTime: "'; WAITFOR DELAY '0:0:5' --",
  blindTimePostgres: "'; SELECT pg_sleep(5); --",
  blindBoolean: "' AND 1=1 --",
  blindBooleanFalse: "' AND 1=2 --",
  
  // Stacked queries
  stackedQuery: "'; INSERT INTO courts (name) VALUES ('hacked'); --",
  
  // Error-based
  errorConvert: "' AND CONVERT(int, (SELECT TOP 1 name FROM sysobjects)) --",
  errorCast: "' AND CAST((SELECT name FROM courts LIMIT 1) AS int) --",
  
  // PostgreSQL specific
  pgVersion: "'; SELECT version(); --",
  pgCurrentUser: "'; SELECT current_user; --",
  pgCopyFrom: "'; COPY (SELECT '') TO PROGRAM 'whoami'; --",
};

// ==================== NOSQL/JSON INJECTION PAYLOADS ====================

export const noSqlInjectionPayloads = {
  // MongoDB-style operators
  gtOperator: { '$gt': '' },
  neOperator: { '$ne': null },
  whereOperator: { '$where': 'this.password.length > 0' },
  regexOperator: { '$regex': '.*' },
  
  // Prototype pollution
  protoPayload: { '__proto__': { 'admin': true } },
  constructorPayload: { 'constructor': { 'prototype': { 'admin': true } } },
  
  // JSON breaking
  nestedDeep: { a: { b: { c: { d: { e: { f: { g: { h: { i: { j: 'deep' } } } } } } } } } },
  circularRef: '{"a": {"b": {"$ref": "$"}}}',
};

// ==================== PATH TRAVERSAL PAYLOADS ====================

export const pathTraversalPayloads = {
  // Basic traversal
  basicTraversal: '../../../etc/passwd',
  windowsTraversal: '..\\..\\..\\windows\\system32\\config\\sam',
  
  // Encoded traversal
  urlEncoded: '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
  doubleUrlEncoded: '%252e%252e%252f%252e%252e%252f%252e%252e%252fetc%252fpasswd',
  
  // Null byte injection
  nullByte: '../../../etc/passwd%00',
  nullByteExt: '../../../etc/passwd%00.png',
  
  // Variations
  mixedSlashes: '..\\../..\\../etc/passwd',
  absolutePath: '/etc/passwd',
  absolutePathWindows: 'C:\\Windows\\System32\\config\\SAM',
};

// ==================== PARAMETER POLLUTION PAYLOADS ====================

export const parameterPollutionPayloads = {
  // Duplicate parameters
  duplicatePage: { page: ['1', '2'] },
  duplicateLimit: { limit: ['10', '100'] },
  duplicateId: { id: ['uuid1', 'uuid2'] },
  
  // Array injection
  arrayParam: 'param[]=value1&param[]=value2',
  nestedArray: 'param[0][nested]=value',
};

// ==================== OVERSIZED PAYLOAD ====================

export function generateOversizedPayload(sizeKb: number = 1024): string {
  const char = 'A';
  return char.repeat(sizeKb * 1024);
}

export const oversizedPayloads = {
  largeName: 'A'.repeat(10000),
  largeDescription: 'B'.repeat(100000),
  largeArray: Array(10000).fill('item'),
  deeplyNested: JSON.parse(
    '{"a":'.repeat(100) + '{}' + '}'.repeat(100)
  ),
};

// ==================== MALFORMED JSON PAYLOADS ====================

export const malformedJsonPayloads = {
  unclosedBrace: '{"name": "test"',
  unclosedBracket: '["item1", "item2"',
  trailingComma: '{"name": "test",}',
  singleQuotes: "{'name': 'test'}",
  unquotedKey: '{name: "test"}',
  invalidUnicode: '{"name": "\\uZZZZ"}',
};

// ==================== UUID VALIDATION PAYLOADS ====================

export const invalidUuidPayloads = {
  tooShort: 'a0eebc99',
  tooLong: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11-extra',
  invalidChars: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380aZZ',
  noHyphens: 'a0eebc999c0b4ef8bb6d6bb9bd380a11',
  sqlInUuid: "a0eebc99-9c0b-4ef8-bb6d'; DROP TABLE courts; --",
  xssInUuid: 'a0eebc99<script>alert(1)</script>',
  pathTraversalInUuid: '../../etc/passwd',
  emptyString: '',
  nullValue: null,
  numberValue: 12345,
};

// ==================== HEADER INJECTION PAYLOADS ====================

export const headerInjectionPayloads = {
  // CRLF injection
  crlfInjection: 'value\r\nX-Injected-Header: malicious',
  
  // Host header attacks
  maliciousHost: 'evil.com',
  hostWithPort: 'evil.com:8080',
  
  // X-Forwarded headers
  spoofedXForwardedFor: '127.0.0.1, 10.0.0.1',
  spoofedXForwardedHost: 'evil.com',
  spoofedXForwardedProto: 'http',
  
  // Content-Type manipulation
  wrongContentType: 'text/plain',
  xmlContentType: 'application/xml',
};

// ==================== COMBINED ATTACK SCENARIOS ====================

export const combinedAttacks = {
  // XSS in SQL context
  xssInSql: "'; <script>alert(1)</script> --",
  
  // SQL in UUID field
  sqlInPath: "a0eebc99-9c0b-4ef8-bb6d' OR '1'='1",
  
  // Path traversal in name
  pathInName: '../../../etc/passwd',
  
  // JSON injection in string field
  jsonInString: '{"$gt": ""}',
};
