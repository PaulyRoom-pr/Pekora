// "Watch together": pick a mutual friend, we create a party and DM them the invite.
import { state } from '../state.js';
import { getMutuals, getUser, inviteToParty, hydrate } from '../data.js';
import { requireLogin } from '../auth.js';
import { navigate } from '../router.js';
import { html, modal, toast, avatarOf, icon } from '../util.js';

export function watchTogether(video = null) {
  requireLogin(async () => {
    const m = modal(html`<p class="muted">Loading your friends…</p>`, { title: 'Watch together' });
    try {
      const ids = await getMutuals(state.user.uid);
      const users = (await Promise.all(ids.map((id) => getUser(id)))).filter(Boolean);
      if (!users.length) {
        m.body.innerHTML = String(html`<div class="stack"><p>You can watch together with friends who <b>subscribe to you</b> while you <b>subscribe to them</b>.</p>
          <p class="muted">Subscribe to someone you know, and once they subscribe back they will show up here and in your messages.</p></div>`);
        return;
      }
      m.body.innerHTML = String(html`<p class="muted">${video ? html`Invite a friend to watch <b>${video.title}</b> with you.` : 'Invite a friend to your party. You can pick a video together once you are in.'}</p>
        <ul class="friend-list">${users.map((u) => html`<li><img class="avatar" src="${avatarOf(u)}" alt=""><div class="grow"><b>${u.displayName}</b><div class="muted">@${u.username}</div></div>
          <button class="btn btn-primary btn-pill" data-friend="${u.id}">${icon('tv', 18)} Invite</button></li>`)}</ul>`);
      m.body.querySelectorAll('[data-friend]').forEach((b) => (b.onclick = async () => {
        b.disabled = true;
        try {
          const partyId = await inviteToParty({ me: state.user.uid, friend: b.dataset.friend, video });
          m.close();
          toast('Invite sent! They will see it in Messages. 🎉', 'success');
          navigate(`/party/${partyId}`);
        } catch (e) {
          console.error(e);
          b.disabled = false;
          toast('Could not start the party.', 'error');
        }
      }));
      hydrate(m.body);
    } catch (e) {
      console.error(e);
      m.body.innerHTML = '<p class="muted">Could not load your friends right now.</p>';
    }
  }, 'Log in to start a watch party.');
}
