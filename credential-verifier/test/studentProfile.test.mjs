import test from 'node:test';
import assert from 'node:assert/strict';
import { extractStudentProfile, profileLabel } from '../src/studentProfile.mjs';

test('recognizes a wrapped student profile without treating it as a credential', () => {
  const payload = { studentProfile: {
    apaarId: '1234-5678-9012',
    pen: 'PEN2024098231',
    fullName: 'Priya Patel',
    schoolDetails: { schoolName: 'Kendriya Vidyalaya No. 1', udiseCode: '27250100101' },
    skills: ['Python Programming', 'Robotics', 'Digital Art']
  } };
  assert.equal(extractStudentProfile(payload), payload.studentProfile);
  assert.equal(extractStudentProfile(payload.studentProfile), payload.studentProfile);
  assert.equal(extractStudentProfile({ type: ['VerifiableCredential'], credentialSubject: {} }), null);
});

test('uses readable labels for profile identifiers and fields', () => {
  assert.equal(profileLabel('apaarId'), 'APAAR ID');
  assert.equal(profileLabel('udiseCode'), 'UDISE code');
  assert.equal(profileLabel('attendancePercentage'), 'Attendance percentage');
  assert.equal(profileLabel('schoolName'), 'School name');
});
