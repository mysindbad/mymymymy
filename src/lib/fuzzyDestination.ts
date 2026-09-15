import { Place } from '../types';

function fold(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function editDistance(a: string, b: string) {
  const left = fold(a);
  const right = fold(b);
  const rows = left.length + 1;
  const cols = right.length + 1;
  const matrix = Array.from({ length: rows }, () => Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i += 1) matrix[i][0] = i;
  for (let j = 0; j < cols; j += 1) matrix[0][j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
      if (i > 1 && j > 1 && left[i - 1] === right[j - 2] && left[i - 2] === right[j - 1]) {
        matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + cost);
      }
    }
  }
  return matrix[left.length][right.length];
}

function candidateStrings(place: Place) {
  return [place.name, place.arabicName, place.frenchName, place.area, place.region]
    .filter((value): value is string => Boolean(value?.trim()));
}

function scoreCandidate(query: string, value: string) {
  const q = fold(query);
  const v = fold(value);
  if (!q || !v) return Number.NEGATIVE_INFINITY;
  if (v === q) return 100;
  if (v.startsWith(q) || q.startsWith(v)) return 90 - Math.abs(v.length - q.length);
  if (v.includes(q)) return 80 - Math.max(0, v.length - q.length) * 0.2;

  const distance = editDistance(q, v);
  const longest = Math.max(q.length, v.length, 1);
  const similarity = 1 - distance / longest;
  const allowedDistance = q.length <= 4 ? 1 : q.length <= 9 ? 2 : 3;
  if (distance > allowedDistance && similarity < 0.72) return Number.NEGATIVE_INFINITY;
  return similarity * 70 - distance * 2;
}

export function rankFuzzyDestinations(query: string, places: Place[], limit = 24): Place[] {
  const ranked = places
    .map((place) => ({
      place,
      score: Math.max(...candidateStrings(place).map((value) => scoreCandidate(query, value))),
    }))
    .filter(({ score }) => Number.isFinite(score) && score > Number.NEGATIVE_INFINITY)
    .sort((a, b) => b.score - a.score || a.place.name.localeCompare(b.place.name));

  return ranked.slice(0, limit).map(({ place }) => place);
}
