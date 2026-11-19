// Progress state for the Leonida Trophy Atlas: which trophies the reader has
// earned, kept in localStorage, plus export to a file and import back. Nothing
// here touches the network; the file round-trips through a download and a
// file picker only.

const STORAGE_KEY = 'leonida-trophy-atlas-v1';
const EXPORT_NAME = 'leonida-trophy-progress.json';

/** Load the earned set from localStorage. Unknown ids are dropped. */
export function loadEarned(knownIds) {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(raw)) return new Set();
    return new Set(raw.filter((id) => knownIds.has(id)));
  } catch {
    return new Set();
  }
}

/** Persist the earned set to localStorage. */
export function saveEarned(earned) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...earned].sort((a, b) => a - b)));
}

/** Count earned trophies per grade, for the progress line. */
export function gradeProgress(trophies, earned) {
  const counts = {};
  for (const trophy of trophies) {
    counts[trophy.grade] ??= { earned: 0, total: 0 };
    counts[trophy.grade].total += 1;
    if (earned.has(trophy.id)) counts[trophy.grade].earned += 1;
  }
  return counts;
}

/** Download the earned set as a JSON file the reader can keep or move. */
export function exportProgress(earned) {
  const payload = {
    app: 'leonida-trophy-atlas',
    game: 'Grand Theft Auto VI',
    exportedAt: new Date().toISOString(),
    earned: [...earned].sort((a, b) => a - b),
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = EXPORT_NAME;
  link.click();
  URL.revokeObjectURL(url);
}

/** Read an exported file back into an earned set. Accepts the export format
 *  above, or a bare JSON array of trophy ids. Unknown ids are dropped. */
export async function importProgress(file, knownIds) {
  const parsed = JSON.parse(await file.text());
  const ids = Array.isArray(parsed) ? parsed : parsed.earned;
  if (!Array.isArray(ids)) throw new Error('Not a Leonida Trophy Atlas progress file.');
  return new Set(ids.filter((id) => knownIds.has(id)));
}
