export const SAMPLE_CREDENTIAL = {
  '@context': [
    'https://www.w3.org/2018/credentials/v1',
    'https://w3id.org/security/suites/ed25519-2020/v1',
    'https://w3id.org/dcc/v1'
  ],
  id: 'urn:uuid:7c0e0b4a-1e42-4f05-b12a-89a1ef4c2b98',
  type: ['VerifiableCredential', 'Assertion', 'OpenBadgeCredential'],
  issuer: {
    id: 'did:key:z6MkhVTX9BF3NGYX6cc7jWpbNnR7cAjH8LUffabZP8Qu4ysC',
    name: 'MIT & Digital Credentials Consortium',
    url: 'https://cs.mit.edu'
  },
  issuanceDate: '2024-06-15T10:00:00.000Z',
  credentialSubject: {
    id: 'did:key:z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH',
    name: 'Alexander J. Mercer',
    hasCredential: {
      type: ['EducationalOccupationalCredential'],
      name: 'Master of Science in Distributed Systems',
      description: 'Demonstrated advanced competencies in decentralized consensus, cryptographic proof verification, zero-knowledge proofs, and secure digital identities.'
    },
    degreeLevel: 'Master of Science (M.S.)',
    major: 'Computer Science & Cryptography',
    gradeAverage: '3.94 / 4.00',
    honors: 'Summa Cum Laude'
  },
  expirationDate: '2030-06-15T10:00:00.000Z',
  credentialStatus: {
    type: 'StatusList2021Entry',
    statusPurpose: 'revocation'
  },
  proof: {
    type: 'Ed25519Signature2020',
    created: '2024-06-15T10:05:22Z',
    verificationMethod: 'did:key:z6MkhVTX9BF3NGYX6cc7jWpbNnR7cAjH8LUffabZP8Qu4ysC#key-1',
    proofPurpose: 'assertionMethod',
    proofValue: 'z4EiTbmC79r4dRaqLQZr2yxQASoMKneHVNHVaWh1xcDoPG2eTwYjKoYaku1Canb7a6Xp5fSogKJyEhkZCaqQ6Y5nw'
  }
};
