/* =========================================================================
   Couche de stockage — Supabase.
   L'app (app.js) lit/écrit dans un objet `state` en mémoire (synchrone).
   Ici on s'occupe de : auth, chargement de cet objet depuis la base,
   et sauvegarde (debounced) vers la base.
   ========================================================================= */

const SB = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const Store = (() => {
  const defaultState = () => ({
    profile: { name: '', age: '', height: '', weight: '', goalWeight: '', diet: '' },
    planning: {},   // planning["YYYY-MM-DD"] = [séances]
    goals: [],      // { id, competition, date, place, expected }
    followups: [],  // { id, date, type, text }
  });

  let state = defaultState(); // objet vivant partagé avec app.js (jamais remplacé)
  let me = null;              // { id, email, role, name } : l'utilisateur connecté
  let activeUserId = null;    // utilisateur dont on affiche/édite les données
  let saveTimer = null;

  // Remplit `state` EN PLACE (pour préserver la référence utilisée par app.js)
  function hydrate(data) {
    const d = defaultState();
    state.profile   = Object.assign(d.profile, (data && data.profile) || {});
    state.planning  = (data && data.planning)  || {};
    state.goals     = (data && data.goals)      || [];
    state.followups = (data && data.followups)  || [];
  }

  async function loadProfile(userId) {
    const { data } = await SB.from('profiles').select('*').eq('id', userId).single();
    return data;
  }

  async function loadStateFor(userId) {
    activeUserId = userId;
    const { data } = await SB.from('app_state').select('data').eq('user_id', userId).single();
    hydrate(data ? data.data : {});
  }

  // Après une connexion : charge le profil + les données de l'utilisateur lui-même
  async function afterLogin(user) {
    me = (await loadProfile(user.id)) || { id: user.id, email: user.email, role: 'client', name: '' };
    await loadStateFor(user.id);
  }

  // Vérifie une session existante au démarrage
  async function init() {
    const { data: { session } } = await SB.auth.getSession();
    if (session) { await afterLogin(session.user); return true; }
    return false;
  }

  // Sauvegarde groupée et différée (appelée par app.js après chaque modif)
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(pushNow, 400);
  }
  async function pushNow() {
    if (!activeUserId) return;
    const { error } = await SB.from('app_state').upsert({
      user_id: activeUserId,
      data: state,
      updated_at: new Date().toISOString(),
    });
    if (error) console.error('Sauvegarde échouée', error);
  }

  // Auth
  const signIn  = (email, password) => SB.auth.signInWithPassword({ email, password });
  const signUp  = (email, password, name) => SB.auth.signUp({ email, password, options: { data: { name } } });
  async function signOut() { await SB.auth.signOut(); me = null; activeUserId = null; }

  // Liste des comptes (le coach l'utilise pour choisir un client ; RLS filtre)
  async function listClients() {
    const { data } = await SB.from('profiles').select('id,email,name,role').order('created_at');
    return data || [];
  }

  return {
    get: () => state,
    save, pushNow, hydrate,
    init, afterLogin, loadStateFor,
    signIn, signUp, signOut, listClients,
    me: () => me,
    activeUserId: () => activeUserId,
  };
})();
