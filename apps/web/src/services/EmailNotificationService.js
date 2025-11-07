import { db } from '../firebase';
import { doc, getDoc, setDoc, addDoc, collection } from 'firebase/firestore';

/**
 * Email Notification Service
 * 
 * This service handles checking user notification preferences and sending email notifications.
 * For production, this should be connected to Firebase Cloud Functions that handle actual email sending
 * via services like SendGrid, Mailgun, or Firebase Extensions.
 */

const APP_NAME = 'AthleteHub';
const APP_URL = window.location.origin;

/**
 * Get user's notification preferences from Firestore
 */
export async function getUserNotificationPreferences(userId) {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      return null;
    }
    
    const userData = userDoc.data();
    return {
      emailNotifications: userData.emailNotifications ?? true,
      email: userData.email || userDoc.id, // Fallback to userId if no email
      displayName: userData.displayName || userData.name || 'User',
      // Notification type preferences
      unreadMessages: userData.unreadMessages ?? true,
      incompleteProfile: userData.incompleteProfile ?? true,
      addToTeam: userData.addToTeam ?? true,
      upcomingEvent: userData.upcomingEvent ?? true,
      newPerformanceResult: userData.newPerformanceResult ?? true,
      coachSuggestedGoals: userData.coachSuggestedGoals ?? true,
      coachAddedFeedback: userData.coachAddedFeedback ?? true,
      coachUpdatedHealthStatus: userData.coachUpdatedHealthStatus ?? true,
    };
  } catch (error) {
    console.error('Error fetching user notification preferences:', error);
    return null;
  }
}

/**
 * Check if user should receive email notifications for a specific type
 */
export async function shouldSendEmailNotification(userId, notificationType) {
  const preferences = await getUserNotificationPreferences(userId);
  if (!preferences) return false;
  
  if (!preferences.emailNotifications) return false;
  if (!preferences.email || preferences.email === userId) return false; // No valid email
  
  return preferences[notificationType] ?? true;
}

/**
 * Format email content for different notification types
 */
function formatEmailContent(type, data) {
  const baseContent = {
    subject: '',
    body: '',
    html: '',
  };

  switch (type) {
    case 'unreadMessages': {
      const { unreadCount, senderName } = data;
      baseContent.subject = `You have ${unreadCount} unread message${unreadCount > 1 ? 's' : ''}`;
      baseContent.body = `You received a new message${senderName ? ` from ${senderName}` : ''}.\n\nYou now have ${unreadCount} unread message${unreadCount > 1 ? 's' : ''}.\n\nView your messages: ${APP_URL}/messages`;
      baseContent.html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #111827;">New Message Received</h2>
          <p>You received a new message${senderName ? ` from ${senderName}` : ''}.</p>
          <p><strong>You now have ${unreadCount} unread message${unreadCount > 1 ? 's' : ''}.</strong></p>
          <a href="${APP_URL}/messages" style="display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 6px; margin-top: 16px;">View Messages</a>
        </div>
      `;
      break;
    }

    case 'incompleteProfile': {
      baseContent.subject = 'Complete Your Profile';
      baseContent.body = `Your profile is incomplete. You can complete it in settings.\n\nComplete your profile: ${APP_URL}/settings`;
      baseContent.html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #111827;">Complete Your Profile</h2>
          <p>Your profile is incomplete. You can complete it in settings.</p>
          <a href="${APP_URL}/settings" style="display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 6px; margin-top: 16px;">Complete Profile</a>
        </div>
      `;
      break;
    }

    case 'addToTeam': {
      const { teamName } = data;
      baseContent.subject = `You've been added to ${teamName || 'a team'}`;
      baseContent.body = `You've been added to the team "${teamName || 'Team'}"!\n\nView your teams: ${APP_URL}/teams`;
      baseContent.html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #111827;">You've been added to a team!</h2>
          <p>You've been added to the team <strong>${teamName || 'Team'}</strong>.</p>
          <a href="${APP_URL}/teams" style="display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 6px; margin-top: 16px;">View Teams</a>
        </div>
      `;
      break;
    }

    case 'upcomingEvent': {
      const { eventTitle, eventDate, eventTime, teamName } = data;
      baseContent.subject = `Upcoming Event: ${eventTitle}`;
      baseContent.body = `You have an upcoming event: ${eventTitle}\n\nDate: ${eventDate}${eventTime ? ` at ${eventTime}` : ''}\nTeam: ${teamName || 'Your Team'}\n\nView calendar: ${APP_URL}/calendar`;
      baseContent.html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #111827;">Upcoming Event</h2>
          <h3 style="color: #374151;">${eventTitle}</h3>
          <p><strong>Date:</strong> ${eventDate}${eventTime ? ` at ${eventTime}` : ''}</p>
          ${teamName ? `<p><strong>Team:</strong> ${teamName}</p>` : ''}
          <a href="${APP_URL}/calendar" style="display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 6px; margin-top: 16px;">View Calendar</a>
        </div>
      `;
      break;
    }

    case 'newPerformanceResult': {
      const { testType, date, coachName } = data;
      baseContent.subject = 'New Performance Result Recorded';
      baseContent.body = `A new performance result has been recorded for you.\n\nTest Type: ${testType || 'Performance'}\nDate: ${date || 'Recent'}\n${coachName ? `Recorded by: ${coachName}\n` : ''}\nView results: ${APP_URL}/results`;
      baseContent.html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #111827;">New Performance Result</h2>
          <p>A new performance result has been recorded for you.</p>
          <ul>
            <li><strong>Test Type:</strong> ${testType || 'Performance'}</li>
            <li><strong>Date:</strong> ${date || 'Recent'}</li>
            ${coachName ? `<li><strong>Recorded by:</strong> ${coachName}</li>` : ''}
          </ul>
          <a href="${APP_URL}/results" style="display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 6px; margin-top: 16px;">View Results</a>
        </div>
      `;
      break;
    }

    case 'coachSuggestedGoals': {
      const { goalTitle, coachName } = data;
      baseContent.subject = `Your coach suggested a new goal: ${goalTitle}`;
      baseContent.body = `Your coach ${coachName || 'Coach'} suggested a new goal for you.\n\nGoal: ${goalTitle}\n\nView goals: ${APP_URL}/goals`;
      baseContent.html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #111827;">New Goal Suggested</h2>
          <p>Your coach <strong>${coachName || 'Coach'}</strong> suggested a new goal for you:</p>
          <div style="background: #f3f4f6; padding: 16px; border-radius: 6px; margin: 16px 0;">
            <h3 style="margin: 0; color: #111827;">${goalTitle}</h3>
          </div>
          <a href="${APP_URL}/goals" style="display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 6px; margin-top: 16px;">View Goals</a>
        </div>
      `;
      break;
    }

    case 'coachAddedFeedback': {
      const { category, coachName } = data;
      baseContent.subject = `New feedback from ${coachName || 'your coach'}`;
      baseContent.body = `Your coach ${coachName || 'Coach'} provided feedback on your performance.\n\nCategory: ${category || 'General'}\n\nView feedback: ${APP_URL}/athlete-feedback`;
      baseContent.html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #111827;">New Feedback Received</h2>
          <p>Your coach <strong>${coachName || 'Coach'}</strong> provided feedback on your performance.</p>
          <p><strong>Category:</strong> ${category || 'General'}</p>
          <a href="${APP_URL}/athlete-feedback" style="display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 6px; margin-top: 16px;">View Feedback</a>
        </div>
      `;
      break;
    }

    case 'coachUpdatedHealthStatus': {
      const { healthStatus, coachName } = data;
      baseContent.subject = `Your health status has been updated`;
      baseContent.body = `Your coach ${coachName || 'Coach'} updated your health status to: ${healthStatus}\n\nView your health status: ${APP_URL}/dashboard`;
      baseContent.html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #111827;">Health Status Updated</h2>
          <p>Your coach <strong>${coachName || 'Coach'}</strong> updated your health status.</p>
          <div style="background: #f3f4f6; padding: 16px; border-radius: 6px; margin: 16px 0;">
            <p style="margin: 0; font-size: 18px; font-weight: 600; color: #111827;">Status: ${healthStatus}</p>
          </div>
          <a href="${APP_URL}/dashboard" style="display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 6px; margin-top: 16px;">View Dashboard</a>
        </div>
      `;
      break;
    }

    default:
      console.warn(`Unknown notification type: ${type}`);
      return null;
  }

  return baseContent;
}

/**
 * Deliver email via Firebase Trigger Email extension (Brevo)
 * The Trigger Email extension listens to writes to the "mail" collection
 */
async function deliverViaExtension({ to, subject, text, html }) {
  try {
    return await addDoc(collection(db, "mail"), {
      to, // string or array
      message: {
        subject,
        text,
        html,
      },
    });
  } catch (error) {
    console.error('Error delivering email via extension:', error);
    throw error;
  }
}

/**
 * Send email notification to a user
 * 
 * Uses Firebase Trigger Email extension with Brevo to send emails.
 * The extension listens to writes to the "mail" collection.
 */
export async function sendEmailNotification(userId, notificationType, data = {}) {
  try {
    // Check if user should receive this notification
    const shouldSend = await shouldSendEmailNotification(userId, notificationType);
    if (!shouldSend) {
      console.log(`Email notification skipped for user ${userId}: preferences disabled`);
      return { success: false, reason: 'preferences_disabled' };
    }

    // Get user preferences to get email address and display name
    const preferences = await getUserNotificationPreferences(userId);
    if (!preferences || !preferences.email) {
      console.log(`Email notification skipped for user ${userId}: no email address`);
      return { success: false, reason: 'no_email' };
    }

    // Format email content
    const emailContent = formatEmailContent(notificationType, data);
    if (!emailContent) {
      console.error(`Failed to format email content for type: ${notificationType}`);
      return { success: false, reason: 'format_error' };
    }

    // Deliver email via Firebase Trigger Email extension
    await deliverViaExtension({
      to: preferences.email,
      subject: emailContent.subject,
      text: emailContent.body,
      html: emailContent.html,
    });

    console.log(`Email queued for ${preferences.email}: ${emailContent.subject}`);
    return { success: true };
  } catch (error) {
    console.error('Error sending email notification:', error);
    return { success: false, reason: 'error', error: error.message };
  }
}

/**
 * Helper function to send notification to multiple users
 */
export async function sendEmailNotificationToMultiple(userIds, notificationType, data = {}) {
  const results = await Promise.allSettled(
    userIds.map(userId => sendEmailNotification(userId, notificationType, data))
  );
  
  return results.map((result, index) => ({
    userId: userIds[index],
    ...(result.status === 'fulfilled' ? result.value : { success: false, error: result.reason }),
  }));
}

/**
 * Check if user's profile is complete and send notification if incomplete
 * Returns true if profile is complete, false otherwise
 */
export async function checkAndNotifyIncompleteProfile(userId, userData, authUser) {
  try {
    // Get user role
    const userRole = userData?.role;
    if (!userRole) return true; // Can't determine completeness without role
    
    let profileComplete = false;
    let requiredFields = [];
    
    if (userRole === "coach") {
      // Coach required fields: displayName, bio, school, sport, team, sportDetails
      requiredFields = ['displayName', 'bio', 'school', 'sport', 'team', 'sportDetails'];
      profileComplete = requiredFields.every(field => {
        const value = field === 'displayName' 
          ? (userData.displayName ?? authUser?.displayName ?? "") 
          : userData[field];
        return value && value.toString().trim() !== "";
      });
    } else if (userRole === "athlete") {
      // Athlete required fields: displayName, bio, school, grade, sport, position, team, experience, sportDetails, goals
      requiredFields = ['displayName', 'bio', 'school', 'grade', 'sport', 'position', 'team', 'experience', 'sportDetails', 'goals'];
      profileComplete = requiredFields.every(field => {
        const value = field === 'displayName' 
          ? (userData.displayName ?? authUser?.displayName ?? "") 
          : userData[field];
        return value && value.toString().trim() !== "";
      });
    } else {
      return true; // Unknown role, consider complete
    }
    
    // If profile is incomplete, check if we should send notification
    if (!profileComplete) {
      // TESTING: Send email every time user visits dashboard
      // Send notification
      await sendEmailNotification(userId, 'incompleteProfile', {});
      console.log('📧 TESTING: Incomplete profile email sent to user', userId);
      
      // COMMENTED OUT FOR TESTING: Check last notification time to avoid spamming (send at most once per week)
      // const lastNotificationTime = userData.lastIncompleteProfileNotification;
      // const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      // 
      // if (!lastNotificationTime || lastNotificationTime < oneWeekAgo) {
      //   // Send notification
      //   await sendEmailNotification(userId, 'incompleteProfile', {});
      //   
      //   // Update last notification time in Firestore (fire and forget)
      //   setDoc(
      //     doc(db, 'users', userId),
      //     { lastIncompleteProfileNotification: Date.now() },
      //     { merge: true }
      //   ).catch(err => console.error('Error updating last notification time:', err));
      // }
    }
    
    return profileComplete;
  } catch (error) {
    console.error('Error checking profile completeness:', error);
    return true; // Assume complete on error to avoid unnecessary notifications
  }
}
