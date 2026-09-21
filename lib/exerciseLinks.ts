/** Supersets & circuits : exercices consécutifs reliés entre eux dans une séance.
 *
 *  Modèle : chaque exercice peut porter `linkNext` = le type du lien qui le relie à
 *  l'exercice SUIVANT de la liste. Une chaîne de liens consécutifs forme un groupe.
 *  Stocker le lien sur l'exercice (et non une table de groupes à part) garantit qu'un
 *  groupe est toujours fait d'exercices adjacents, et survit tel quel aux copies de
 *  séance (duplication, copie vers un sportif, séance ↔ séance type).
 *
 *  Toutes les fonctions MUTENT la liste reçue (compatible avec un brouillon immer).
 */

export type ExerciseLinkType = "superset" | "circuit";

interface Linkable {
  linkNext?: ExerciseLinkType;
}

export interface ExerciseGroup {
  /** Indices (dans la liste) des exercices du groupe, dans l'ordre. */
  indices: number[];
  /** null = exercice seul. */
  type: ExerciseLinkType | null;
}

/** Bornes [début, fin] (indices de liens) de la chaîne qui contient le lien `i`. */
function chainOf(list: Linkable[], i: number): [number, number] {
  let a = i;
  while (a > 0 && list[a - 1].linkNext) a--;
  let b = i;
  while (b < list.length - 2 && list[b + 1].linkNext) b++;
  return [a, b];
}

/** Découpe la liste en groupes (reliés) et exercices seuls, dans l'ordre. */
export function groupExercises(list: Linkable[]): ExerciseGroup[] {
  const groups: ExerciseGroup[] = [];
  let cur: number[] = [];
  let type: ExerciseLinkType | null = null;
  list.forEach((ex, i) => {
    cur.push(i);
    // Le dernier exercice ne peut relier à rien : son éventuel linkNext est ignoré.
    const link = i < list.length - 1 ? ex.linkNext : undefined;
    if (link) {
      type = type ?? link;
    } else {
      groups.push({ indices: cur, type: cur.length > 1 ? type : null });
      cur = [];
      type = null;
    }
  });
  return groups;
}

/** Relie l'exercice `i` au suivant. Rejoindre un groupe existant hérite de son type,
 *  pour qu'un groupe n'ait jamais qu'un seul type. */
export function linkAt(list: Linkable[], i: number): void {
  if (i < 0 || i >= list.length - 1) return;
  const inherited = (i > 0 ? list[i - 1].linkNext : undefined) ?? list[i + 1]?.linkNext;
  list[i].linkNext = inherited ?? "superset";
  setChainType(list, i, list[i].linkNext!);
}

/** Coupe le lien entre l'exercice `i` et le suivant. */
export function cutAt(list: Linkable[], i: number): void {
  if (list[i]) list[i].linkNext = undefined;
}

/** Bascule tout le groupe du lien `i` entre superset et circuit. */
export function toggleGroupType(list: Linkable[], i: number): void {
  const cur = list[i]?.linkNext;
  if (!cur) return;
  setChainType(list, i, cur === "superset" ? "circuit" : "superset");
}

function setChainType(list: Linkable[], i: number, type: ExerciseLinkType): void {
  const [a, b] = chainOf(list, i);
  for (let k = a; k <= b; k++) list[k].linkNext = type;
}

/** Sort l'exercice `i` de son groupe SANS casser le reste du groupe : dans A-B-C,
 *  détacher B laisse A relié à C (leur lien reprend la place de celui de B). */
export function detach(list: Linkable[], i: number): void {
  const prev = i > 0 ? list[i - 1] : undefined;
  if (prev?.linkNext && !list[i].linkNext) prev.linkNext = undefined;
  list[i].linkNext = undefined;
}

/** À appeler avant de retirer l'exercice `i` de la liste. */
export function beforeRemove(list: Linkable[], i: number): void {
  if (i < 0 || i >= list.length) return;
  detach(list, i);
}

/** Déplace l'exercice `i` d'un cran (dir = ±1). Il quitte son groupe et arrive seul :
 *  un lien ne peut exister qu'entre exercices voisins, donc aucun lien ne doit
 *  pointer vers lui à sa nouvelle place. */
export function moveWithLinks(list: Linkable[], i: number, dir: -1 | 1): void {
  const target = i + dir;
  if (target < 0 || target >= list.length) return;
  detach(list, i);
  [list[i], list[target]] = [list[target], list[i]];
  const before = list[target - 1];
  if (before) before.linkNext = undefined;
}
