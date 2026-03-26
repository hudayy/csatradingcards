import { getMembers, getLeaguePlayers, getCurrentSeason } from './src/lib/csa-api';

async function test() {
  const members = await getMembers();
  console.log("Total members loaded:", members.length);
  
  const season = await getCurrentSeason();
  if (!season) return console.log("No season");

  const players = await getLeaguePlayers({ seasonId: season.id, active: true });
  console.log("Total players loaded:", players.length);
  
  const m = members.find(mem => mem.csa_id === players[0].Player.csa_id);
  console.log("Player 0 csa_id:", players[0].Player.csa_id);
  console.log("Member found:", !!m);
  if (m) {
    console.log("Avatar:", m.avatar_url);
    console.log("Member Obj:", m);
  }
}

test().catch(console.error);
