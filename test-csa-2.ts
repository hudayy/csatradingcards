import { getMembers } from './src/lib/csa-api';

async function test() {
  const members = await getMembers();
  const names = ['nitrous', 'jazii', 'jay', 'realize', 'eris', 'shayköz', 'lovely reshi'];
  for (const name of names) {
    const m = members.find(mem => mem.csa_name.toLowerCase() === name.toLowerCase());
    console.log(name, ":", m ? m.avatar_url : "NOT FOUND");
  }
}
test();
