/* =========================================================================
   Couche de stockage. Aujourd'hui : localStorage.
   Demain : remplace le corps de ces fonctions par des appels Supabase,
   sans rien changer dans app.js (même interface : load / save).
   ========================================================================= */

const Store = (() => {
  const KEY = 'nmry-coaching-v1';

  // État par défaut (structure complète de l'application)
  const defaultState = () => ({
    profile: {
      name: '',
      age: '',
      height: '',
      weight: '',
      goalWeight: '',
      diet: '',
    },
    // planning[ "YYYY-MM-DD" ] = [ séance, séance, ... ]
    planning: {},
    goals: [], // { id, competition, date, place, expected }
    followups: [], // { id, date, type:'note'|'injury', text }
  });

  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultState();
      return Object.assign(defaultState(), JSON.parse(raw));
    } catch (e) {
      console.warn('Lecture stockage impossible, réinitialisation.', e);
      return defaultState();
    }
  }

  function save() {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  return {
    get: () => state,
    save,
    reset() {
      state = defaultState();
      save();
    },
  };
})();
