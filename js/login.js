import { supabase, redirectIfSession } from './supabase.js';
import { byId, safeOn } from './utils/dom.js';

async function initLogin() {
  await redirectIfSession('./app.html');

  const msg = byId('msg');
  const loginBtn = byId('loginBtn');

  safeOn(loginBtn, 'click', async () => {
    const email = (byId('email').value || '').trim();
    const password = (byId('password').value || '').trim();

    if (!email || !password) {
      msg.textContent = 'Email et mot de passe requis.';
      return;
    }

    loginBtn.disabled = true;
    msg.textContent = 'Connexion…';

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    loginBtn.disabled = false;
    if (error) {
      msg.textContent = `Erreur: ${error.message}`;
      return;
    }

    window.location.href = './app.html';
  });
}

initLogin();
