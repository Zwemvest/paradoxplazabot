/**
 * Paradox Plaza Rule 5 Bot
 * Main entry point for Devvit app
 */

import { Devvit } from '@devvit/public-api';
import { settingsDefinitions } from './settings/definitions.js';

// ============================================================================
// Configure Devvit
// ============================================================================

Devvit.configure({
  redditAPI: true,
  redis: true,
  http: true, // For Slack/Discord webhooks
});

// ============================================================================
// Register Settings
// ============================================================================

Devvit.addSettings(settingsDefinitions);

// ============================================================================
// Event Handlers
// ============================================================================

import { onPostSubmit } from './handlers/postSubmit.js';
import { onModMail } from './handlers/modMailHandler.js';

// Feature 1002: Trigger-Based Post Detection
Devvit.addTrigger({
  event: 'PostSubmit',
  onEvent: onPostSubmit,
});

// Feature 7001: ModMail Handler
Devvit.addTrigger({
  event: 'ModMail',
  onEvent: onModMail,
});

// ============================================================================
// Scheduled Jobs
// ============================================================================

import { onQueuePolling } from './handlers/queuePolling.js';
import { checkWarning } from './services/warningSystem.js';
import { checkRemoval } from './services/removalSystem.js';
import { checkForR5Addition, monitorWarnedPosts } from './services/reinstatementSystem.js';

// Feature 1001/1005: Queue Polling (backup to PostSubmit triggers)
Devvit.addSchedulerJob({
  name: 'pollNewQueue',
  onRun: onQueuePolling,
});

// Feature 4002: Warning Check Job
Devvit.addSchedulerJob({
  name: 'checkWarning',
  onRun: async (event, context) => {
    const postId = event.data?.postId as string;
    if (postId) {
      await checkWarning(postId, context);
    }
  },
});

// Feature 5002: Removal Check Job
Devvit.addSchedulerJob({
  name: 'checkRemoval',
  onRun: async (event, context) => {
    const postId = event.data?.postId as string;
    if (postId) {
      await checkRemoval(postId, context);
    }
  },
});

// Feature 6001: R5 Monitoring for Reinstatement
Devvit.addSchedulerJob({
  name: 'checkR5Addition',
  onRun: async (event, context) => {
    const postId = event.data?.postId as string;
    if (postId) {
      await checkForR5Addition(postId, context);
    } else {
      // Periodic sweep of all warned posts
      await monitorWarnedPosts(context);
    }
  },
});

// ============================================================================
// Export App
// ============================================================================

export default Devvit;
