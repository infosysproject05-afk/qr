export function extractStudentProfile(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const profile = data.studentProfile ?? data;
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return null;
  return ('fullName' in profile && ('apaarId' in profile || 'pen' in profile || 'schoolDetails' in profile))
    ? profile
    : null;
}

const LABELS = {
  apaarId: 'APAAR ID',
  pen: 'PEN',
  fullName: 'Full name',
  dateOfBirth: 'Date of birth',
  academicYear: 'Academic year',
  rollNo: 'Roll number',
  udiseCode: 'UDISE code',
  schoolName: 'School name',
  attendancePercentage: 'Attendance percentage'
};

export function profileLabel(key) {
  return LABELS[key] || key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/^./, character => character.toUpperCase());
}
