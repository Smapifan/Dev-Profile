const fs = require('fs');
const path = require('path');
const axios = require('axios');

const NEXUS_API_BASE = 'https://api.nexusmods.com/v1';
const CURSEFORGE_API_BASE = 'https://api.curseforge.com/v1';

const profiles = ['Smapifan', 'MaggPlays']; // Add your profiles here

async function fetchNexusMods(username, apiKey) {
  try {
    const response = await axios.get(
      `${NEXUS_API_BASE}/users/${username}/mods`,
      {
        headers: {
          'apikey': apiKey,
          'Application-Name': 'dev-mods-website/1.0'
        }
      }
    );
    
    return response.data.map(mod => ({
      id: mod.mod_id,
      name: mod.name,
      description: mod.summary || '',
      downloads: mod.mod_downloads,
      endorsements: mod.endorsements,
      url: `https://www.nexusmods.com/*/mods/${mod.mod_id}`,
      lastUpdated: mod.uploaded_time
    }));
  } catch (error) {
    console.error(`Error fetching Nexus mods for ${username}:`, error.message);
    return [];
  }
}

async function fetchCurseForgeMods(username, apiKey) {
  try {
    // Note: CurseForge API requires project IDs, not usernames
    // This is a placeholder - you need to configure this differently
    console.log(`CurseForge API requires project configuration for ${username}`);
    return [];
  } catch (error) {
    console.error(`Error fetching CurseForge mods for ${username}:`, error.message);
    return [];
  }
}

async function updateProfile(username) {
  const profileDir = path.join(__dirname, '../../docs', username);
  const jsonPath = path.join(profileDir, 'en.json');
  
  if (!fs.existsSync(jsonPath)) {
    console.log(`Profile ${username} not found, skipping...`);
    return;
  }
  
  let data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  
  // Fetch Nexus mods
  if (data.nexus.enabled && process.env.NEXUS_API_KEY) {
    console.log(`Fetching Nexus mods for ${username}...`);
    data.nexus.mods = await fetchNexusMods(data.nexus.username, process.env.NEXUS_API_KEY);
  }
  
  // Fetch CurseForge mods
  if (data.curseforge.enabled && process.env.CURSEFORGE_API_KEY) {
    console.log(`Fetching CurseForge mods for ${username}...`);
    data.curseforge.mods = await fetchCurseForgeMods(data.curseforge.username, process.env.CURSEFORGE_API_KEY);
  }
  
  // Update timestamp
  data.lastUpdated = new Date().toISOString();
  
  // Write back to file
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
  console.log(`Updated profile: ${username}`);
}

async function main() {
  console.log('Starting mods data fetch...');
  
  for (const profile of profiles) {
    await updateProfile(profile);
  }
  
  console.log('Done!');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
