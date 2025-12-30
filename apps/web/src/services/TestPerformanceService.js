// src/services/TestPerformanceService.js

import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  query, 
  where, 
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { sendEmailNotification } from './EmailNotificationService';

/**
 * Convert time string (MM:SS.s) to seconds
 * Examples: "6:30.5" -> 390.5, "1:37.6" -> 97.6
 */
export function timeStringToSeconds(timeStr) {
  if (!timeStr || timeStr === '--:--.-') return 0;
  
  const parts = timeStr.split(':');
  if (parts.length !== 2) return 0;
  
  const minutes = parseInt(parts[0]);
  const seconds = parseFloat(parts[1]);
  
  return minutes * 60 + seconds;
}

/**
 * Convert seconds to time string (MM:SS.s)
 * Examples: 390.5 -> "6:30.5", 97.6 -> "1:37.6"
 */
export function secondsToTimeString(totalSeconds) {
  if (!totalSeconds || totalSeconds === 0) return '--:--.-';
  
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = (totalSeconds % 60).toFixed(1);
  
  return `${minutes}:${seconds.padStart(4, '0')}`;
}

/**
 * Calculate split/pace based on sport and distance
 * @param {number} timeInSeconds - Total time in seconds
 * @param {string} sport - Sport type
 * @param {string} testType - Test type (2k, 5k, Mile, etc.)
 * @returns {string} Formatted split time
 */
export function calculateSplit(timeInSeconds, sport, testType) {
  if (!timeInSeconds || timeInSeconds === 0) return '--:--.-';
  
  const sportLower = sport?.toLowerCase() || '';
  
  switch (sportLower) {
    case 'rowing': {
      // Split per 500m
      const distance = testType === '2k' ? 2000 : 
                      testType === '5k' ? 5000 : 
                      testType === '6k' ? 6000 : 
                      testType === '30min' ? 0 :
                      testType === '60min' ? 0 : 2000;
      
      if (distance === 0) return '--:--.-';
      const splitTime = (timeInSeconds / distance) * 500;
      return secondsToTimeString(splitTime);
    }
    
    case 'running':
    case 'track':
    case 'cross country': {
      const distanceInMiles = testType === 'Mile' ? 1 :
                             testType === '5K' ? 3.10686 :
                             testType === '10K' ? 6.21371 :
                             testType === 'Half Marathon' ? 13.1094 :
                             testType === 'Marathon' ? 26.2188 : 1;
      const pacePerMile = timeInSeconds / distanceInMiles;
      return secondsToTimeString(pacePerMile);
    }
    
    case 'swimming': {
      const distance = testType === '50 Free' ? 50 :
                      testType === '100 Free' ? 100 :
                      testType === '200 Free' ? 200 :
                      testType === '500 Free' ? 500 :
                      testType === '100 Fly' ? 100 :
                      testType === '200 IM' ? 200 : 100;
      const pacePerHundred = (timeInSeconds / distance) * 100;
      return secondsToTimeString(pacePerHundred);
    }
    
    default:
      return '--:--.-';
  }
}

/**
 * Calculate watts from split time (rowing only)
 */
export function calculateWatts(timeInSeconds, testType) {
  if (testType === '30min' || testType === '60min') return 0;
  
  const distance = testType === '2k' ? 2000 : 
                  testType === '5k' ? 5000 : 
                  testType === '6k' ? 6000 : 0;
  
  if (distance === 0 || timeInSeconds === 0) return 0;
  
  const splitPer500 = (timeInSeconds / distance) * 500;
  const watts = 2.8 / Math.pow(splitPer500, 3);
  return Math.round(watts);
}

export async function addTestPerformance(userId, performanceData) {
  try {
    const {
      athleteName,
      sport,
      testType,
      distance,
      time,
      completed = true,
      date,
      notes = '',
      coachId = null,
      coachName = null,
      // NEW: Accept additional fields from EnterResults
      splits,
      splitsDetailed,
      avgSplit,
      avgSPM,
      totalTime,
      watts: providedWatts,
      wattsPerKg,
      athleteWeight,
      rate,
      // 2x5k specific
      p1AvgSplit,
      p2AvgSplit,
      p1Watts,
      p2Watts,
      deltaWatts,
    } = performanceData;
    
    const timeInSeconds = timeStringToSeconds(time);
    
    // Use provided split/watts if available, otherwise calculate
    const calculatedSplit = calculateSplit(timeInSeconds, sport, testType);
    const finalSplit = avgSplit || calculatedSplit;
    
    const calculatedWatts = sport?.toLowerCase() === 'rowing' ? calculateWatts(timeInSeconds, testType) : 0;
    const finalWatts = providedWatts || calculatedWatts;
    
    // Build the document data
    const docData = {
      userId,
      athleteName,
      sport,
      testType,
      distance,
      time,
      timeInSeconds,
      split: finalSplit,
      watts: finalWatts,
      completed,
      // FIXED: Store date as STRING to avoid timezone issues
      // The date comes in as "2025-12-23" and we keep it that way
      date: typeof date === 'string' ? date : (date instanceof Timestamp ? date.toDate().toISOString().split('T')[0] : new Date(date).toISOString().split('T')[0]),
      notes,
      coachId,
      coachName,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
    
    // Add optional fields only if they have values
    if (splits && splits.length > 0) {
      docData.splits = splits;
    }
    if (splitsDetailed && splitsDetailed.length > 0) {
      docData.splitsDetailed = splitsDetailed;
    }
    if (avgSPM) {
      docData.avgSPM = avgSPM;
    }
    if (totalTime) {
      docData.totalTime = totalTime;
    }
    if (wattsPerKg) {
      docData.wattsPerKg = wattsPerKg;
    }
    if (athleteWeight) {
      docData.athleteWeight = athleteWeight;
    }
    if (rate) {
      docData.rate = rate;
    }
    
    // 2x5k specific fields
    if (p1AvgSplit) docData.p1AvgSplit = p1AvgSplit;
    if (p2AvgSplit) docData.p2AvgSplit = p2AvgSplit;
    if (p1Watts) docData.p1Watts = p1Watts;
    if (p2Watts) docData.p2Watts = p2Watts;
    if (deltaWatts !== undefined) docData.deltaWatts = deltaWatts;
    
    console.log('TestPerformanceService saving:', docData); // Debug log
    
    const docRef = await addDoc(
      collection(db, 'users', userId, 'testPerformances'),
      docData
    );
    
    // Send email notification (fire and forget)
    const dateStr = typeof date === 'string' ? date : new Date(date).toLocaleDateString();
    
    sendEmailNotification(userId, 'newPerformanceResult', {
      testType: testType || 'Performance',
      date: dateStr,
      coachName: coachName || 'Coach',
    }).catch((emailError) => {
      console.error('Error sending email notification:', emailError);
    });
    
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error adding test performance:', error);
    return { success: false, error: error.message };
  }
}

export async function updateTestPerformance(userId, testId, updates) {
  try {
    const docRef = doc(db, 'users', userId, 'testPerformances', testId);
    
    if (updates.time) {
      const timeInSeconds = timeStringToSeconds(updates.time);
      updates.timeInSeconds = timeInSeconds;
      if (!updates.split) {
        updates.split = calculateSplit(timeInSeconds, updates.sport, updates.testType);
      }
      if (updates.sport?.toLowerCase() === 'rowing' && !updates.watts) {
        updates.watts = calculateWatts(timeInSeconds, updates.testType);
      }
    }
    
    // If date is being updated, ensure it stays as string
    if (updates.date && typeof updates.date !== 'string') {
      updates.date = updates.date instanceof Timestamp 
        ? updates.date.toDate().toISOString().split('T')[0] 
        : new Date(updates.date).toISOString().split('T')[0];
    }
    
    updates.updatedAt = Timestamp.now();
    
    await updateDoc(docRef, updates);
    return { success: true };
  } catch (error) {
    console.error('Error updating test performance:', error);
    return { success: false, error: error.message };
  }
}

export async function deleteTestPerformance(userId, testId) {
  try {
    const docRef = doc(db, 'users', userId, 'testPerformances', testId);
    await deleteDoc(docRef);
    return { success: true };
  } catch (error) {
    console.error('Error deleting test performance:', error);
    return { success: false, error: error.message };
  }
}

export async function getUserTestPerformances(userId, filters = {}) {
  try {
    const testPerfsRef = collection(db, 'users', userId, 'testPerformances');
    let q = query(testPerfsRef, orderBy('createdAt', 'desc'));
    
    if (filters.testType && filters.testType !== 'All') {
      q = query(testPerfsRef, where('testType', '==', filters.testType), orderBy('createdAt', 'desc'));
    }
    if (filters.completed !== undefined) {
      q = query(testPerfsRef, where('completed', '==', filters.completed), orderBy('createdAt', 'desc'));
    }
    
    const snapshot = await getDocs(q);
    const performances = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        // Handle date - could be string or Timestamp
        date: typeof data.date === 'string' ? data.date : (data.date?.toDate ? data.date.toDate() : null)
      };
    });
    
    return { success: true, data: performances };
  } catch (error) {
    console.error('Error getting test performances:', error);
    return { success: false, error: error.message, data: [] };
  }
}

export async function getTeamTestPerformances(athleteIds, filters = {}) {
  try {
    const allPerformances = [];
    
    for (const athleteId of athleteIds) {
      const result = await getUserTestPerformances(athleteId, filters);
      if (result.success && result.data) {
        allPerformances.push(...result.data);
      }
    }
    
    allPerformances.sort((a, b) => {
      const dateA = a.date || new Date(0);
      const dateB = b.date || new Date(0);
      return dateB - dateA;
    });
    
    return { success: true, data: allPerformances };
  } catch (error) {
    console.error('Error getting team test performances:', error);
    return { success: false, error: error.message, data: [] };
  }
}

export async function getAthleteBestTimes(userId) {
  try {
    const result = await getUserTestPerformances(userId, { completed: true });
    
    if (!result.success || !result.data) {
      return { success: true, data: {} };
    }
    
    const bestTimes = {};
    result.data.forEach(perf => {
      if (perf.timeInSeconds > 0) {
        if (!bestTimes[perf.testType] || perf.timeInSeconds < bestTimes[perf.testType]) {
          bestTimes[perf.testType] = perf.timeInSeconds;
        }
      }
    });
    
    return { success: true, data: bestTimes };
  } catch (error) {
    console.error('Error getting athlete best times:', error);
    return { success: false, error: error.message, data: {} };
  }
}

export async function getTeamBestTimes(athleteIds) {
  try {
    const athleteData = [];
    
    for (const athleteId of athleteIds) {
      const result = await getAthleteBestTimes(athleteId);
      if (result.success) {
        athleteData.push({
          id: athleteId,
          testPieces: result.data
        });
      }
    }
    
    return { success: true, data: athleteData };
  } catch (error) {
    console.error('Error getting team best times:', error);
    return { success: false, error: error.message, data: [] };
  }
}

export default {
  timeStringToSeconds,
  secondsToTimeString,
  calculateSplit,
  calculateWatts,
  addTestPerformance,
  updateTestPerformance,
  deleteTestPerformance,
  getUserTestPerformances,
  getTeamTestPerformances,
  getAthleteBestTimes,
  getTeamBestTimes
};