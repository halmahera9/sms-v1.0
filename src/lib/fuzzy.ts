import { Student } from '@/types/sms';

/**
 * Calculates Levenshtein Distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  const s1 = a.toLowerCase().trim();
  const s2 = b.toLowerCase().trim();
  
  if (s1 === s2) return 0;
  if (s1.length === 0) return s2.length;
  if (s2.length === 0) return s1.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= s1.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= s2.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[s1.length][s2.length];
}

/**
 * Calculates similarity percentage between two strings (0 to 100)
 */
export function stringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  const maxLength = Math.max(s1.length, s2.length);
  if (maxLength === 0) return 100;
  
  const distance = levenshteinDistance(s1, s2);
  const similarity = ((maxLength - distance) / maxLength) * 100;
  return Math.max(0, Math.min(100, Math.round(similarity)));
}

export interface MatchResult {
  student?: Student;
  confidence: number;
}

/**
 * Finds best matching student for given OCR text
 */
export function findBestStudentMatch(ocrText: string, students: Student[]): MatchResult {
  if (!ocrText || students.length === 0) {
    return { confidence: 0 };
  }

  let bestMatch: Student | undefined;
  let highestScore = 0;

  for (const student of students) {
    const score = stringSimilarity(ocrText, student.name);
    if (score > highestScore) {
      highestScore = score;
      bestMatch = student;
    }
  }

  return {
    student: bestMatch,
    confidence: highestScore
  };
}
