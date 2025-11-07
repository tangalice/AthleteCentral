// src/services/teamService.js

import { db } from "../firebase"; // Adjust path if firebase.js is elsewhere
import { 
  doc, 
  getDoc, 
  collection, 
  getDocs 
} from "firebase/firestore";

/**
 * Fetches all athletes (non-coaches) associated with a specific team.
 * This function aggregates athlete IDs from:
 * 1. The 'members' array in the team document.
 * 2. The 'athletes' array in the team document.
 * 3. The 'athletes' subcollection.
 *
 * It then filters out any IDs that also appear in the 'coaches' array.
 * Finally, it fetches the user profile for each valid athlete ID from the 'users' collection.
 *
 * @param {string} teamId - The ID of the team to fetch athletes for.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of athlete objects,
 * each containing { id, name, email }.
 * Returns an empty array if the team doesn't exist.
 */
export async function fetchTeamAthletes(teamId) {
  const tDoc = await getDoc(doc(db, "teams", teamId));
  if (!tDoc.exists()) {
    console.warn(`teamService: Team document with ID ${teamId} not found.`);
    return [];
  }

  const td = tDoc.data() || {};
  const coaches = new Set(Array.isArray(td.coaches) ? td.coaches : []);
  const athleteIds = new Set();

  // 1. Get IDs from team document 'members' array
  (Array.isArray(td.members) ? td.members : []).forEach((id) => athleteIds.add(id));
  
  // 2. Get IDs from team document 'athletes' array
  (Array.isArray(td.athletes) ? td.athletes : []).forEach((id) => athleteIds.add(id));

  // 3. Get IDs from subcollection 'athletes'
  try {
    const subSnap = await getDocs(collection(db, "teams", teamId, "athletes"));
    subSnap.forEach((d) => athleteIds.add(d.id));
  } catch (e) {
    console.error(`teamService: Failed to fetch 'athletes' subcollection for team ${teamId}`, e);
    // Continue without subcollection data if it fails
  }

  // 4. Filter out any user who is a coach
  const finalAthleteIds = Array.from(athleteIds).filter(uid => !coaches.has(uid));
  
  // 5. Hydrate user details from 'users/{uid}' collection
  const members = [];
  const userPromises = finalAthleteIds.map(async (uid) => {
    try {
      const uSnap = await getDoc(doc(db, "users", uid));
      if (uSnap.exists()) {
        const d = uSnap.data() || {};
        // Find the best available name
        const name = d.displayName || d.name || d.firstName || d.email?.split('@')[0] || `Athlete ${uid.slice(0, 6)}`;
        members.push({ 
          id: uid, 
          name: name, 
          email: d.email || '' 
        });
      } else {
        console.warn(`teamService: User document ${uid} not found in 'users' collection.`);
      }
    } catch (e) {
      console.error(`teamService: Failed to fetch user profile ${uid}`, e);
    }
  });

  await Promise.all(userPromises);

  // 6. Sort by name for consistent display
  members.sort((a, b) => a.name.localeCompare(b.name));
  
  return members;
}

// You can add more team-related functions here in the future,
// e.g., fetchTeamCoaches(teamId), fetchTeamDetails(teamId), etc.