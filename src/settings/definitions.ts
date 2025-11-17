/**
 * Settings definitions for Devvit configuration UI
 * Based on 8000-settings-management.md
 */

import { SettingsFormField } from '@devvit/public-api';

export const settingsDefinitions: SettingsFormField[] = [
  // ============================================================================
  // Post Type Enforcement
  // ============================================================================
  {
    type: 'select',
    name: 'enforcedposttypes',
    label: 'Enforce on Post Types',
    helpText: 'Select which post types require R5 explanations (multi-select)',
    multiSelect: true,
    options: [
      { label: 'Image (post_hint = image)', value: 'image' },
      { label: 'Image Gallery (is_gallery = true)', value: 'gallery' },
      { label: 'Video (post_hint = video or is_video)', value: 'video' },
      { label: 'Text with Image URL', value: 'text_image' },
      { label: 'Text with Video URL', value: 'text_video' },
      { label: 'Text Containing Keywords', value: 'text_keywords' },
      { label: 'Text with Any URL', value: 'text_url' },
      { label: 'Link to Image', value: 'link_image' },
      { label: 'Link to Video', value: 'link_video' },
      { label: 'Links from Specific Domains', value: 'link_domains' },
      { label: 'All Links (url not empty)', value: 'link_all' },
    ],
    defaultValue: ['image', 'gallery', 'text_image', 'link_image'],
  },

  // ============================================================================
  // Post Monitoring
  // ============================================================================
  {
    type: 'boolean',
    name: 'enablepolling',
    label: 'Enable Queue Polling',
    helpText: 'Enable periodic queue polling as backup to PostSubmit triggers',
    defaultValue: false,
  },
  {
    type: 'number',
    name: 'queuelimit',
    label: 'Queue Poll Limit',
    helpText: 'Maximum posts to check per poll',
    defaultValue: 100,
    onValidate: (value) => {
      const num = value as unknown as number;
      if (num < 1) return 'Queue limit must be at least 1';
      if (num > 1000) return 'Queue limit cannot exceed 1000';
    },
  },

  // ============================================================================
  // Exclusions
  // ============================================================================
  {
    type: 'string',
    name: 'allowlistedusers',
    label: 'Allowed Authors',
    helpText: 'Comma-separated usernames to always skip (e.g., "automod,fatherlorris")',
    defaultValue: '',
  },
  {
    type: 'number',
    name: 'maxpostage',
    label: 'Skip Posts Older Than (hours)',
    helpText: 'Skip enforcement on posts older than X hours. Set to 0 to disable.',
    defaultValue: 0,
    onValidate: (value) => {
      const num = value as unknown as number;
      if (num < 0) return 'Post age cannot be negative';
      if (num > 720) return 'Post age cannot exceed 30 days (720 hours)';
    },
  },
  {
    type: 'number',
    name: 'skipupvotethreshold',
    label: 'Skip Posts with More Than X Upvotes',
    helpText: 'Skip enforcement on popular posts. Set to 0 to disable.',
    defaultValue: 0,
    onValidate: (value) => {
      if ((value as unknown as number) < 0) return 'Upvote threshold cannot be negative';
    },
  },
  {
    type: 'paragraph',
    name: 'textpostexclusionstartswith',
    label: 'Skip Text Posts Starting With',
    helpText: 'One per line. Example: "Discussion:", "Question:", "Meta:"',
    defaultValue: '',
  },
  {
    type: 'paragraph',
    name: 'textpostexclusioncontainsone',
    label: 'Skip Text Posts Containing',
    helpText: 'One per line. Example: "discussion", "question", "announcement"',
    defaultValue: '',
  },
  {
    type: 'string',
    name: 'linkdomainexclusions',
    label: 'Excluded Link Domains',
    helpText: 'Comma-separated domains to skip (e.g., "wikipedia.org,reddit.com")',
    defaultValue: '',
  },
  {
    type: 'boolean',
    name: 'respectmodapprovals',
    label: 'Skip Moderator-Approved Posts',
    helpText: 'Skip enforcement on posts manually approved by moderators',
    defaultValue: true,
  },
  {
    type: 'boolean',
    name: 'skipmodremoved',
    label: 'Skip Moderator-Removed Posts',
    helpText: 'Skip enforcement on posts already removed by moderators',
    defaultValue: true,
  },
  {
    type: 'boolean',
    name: 'skipifmodcomment',
    label: 'Skip if Moderator Comments',
    helpText: 'Skip enforcement if moderator comments with matching keywords',
    defaultValue: false,
  },
  {
    type: 'paragraph',
    name: 'modcommentskipkeywords',
    label: 'Moderator Comment Skip Keywords',
    helpText: 'One per line. Example: "approved", "exception granted", "r5 waived"',
    defaultValue: '',
  },

  // ============================================================================
  // Known Domains
  // ============================================================================
  {
    type: 'paragraph',
    name: 'imagedomains',
    label: 'Known Image Domains',
    helpText: 'One domain/pattern per line. Used to detect image posts.',
    defaultValue: `steamusercontent.com
steamuserimages-a.akamaihd.net
steamcommunity.com/sharedfiles
i.redd.it
i.reddit
i.reddituploads.com
i.redditmedia.com
twimg.com
imgur.com
sli.mg
gyazo.com
.png
.gif
.jpg
.jpeg
.webp`,
  },
  {
    type: 'paragraph',
    name: 'videodomains',
    label: 'Known Video Domains',
    helpText: 'One domain/pattern per line. Used to detect video posts.',
    defaultValue: `v.redd.it
youtube.com
youtu.be
twitch.tv
clips.twitch.tv
streamable.com
gfycat.com
redgifs.com
.mp4
.webm
.mov
.avi`,
  },
  {
    type: 'paragraph',
    name: 'linkenforcementdomains',
    label: 'Link Enforcement Domains',
    helpText: 'Links from these domains require R5. One domain per line.',
    defaultValue: '',
  },

  // ============================================================================
  // Keywords
  // ============================================================================
  {
    type: 'paragraph',
    name: 'enforcementkeywords',
    label: 'Enforcement Keywords',
    helpText: 'Text posts containing these keywords require R5. One per line.',
    defaultValue: '',
  },
  {
    type: 'paragraph',
    name: 'skipkeywords',
    label: 'Skip Keywords',
    helpText: 'Text posts containing these keywords skip enforcement (highest priority). One per line.',
    defaultValue: '',
  },

  // ============================================================================
  // Flairs
  // ============================================================================
  {
    type: 'string',
    name: 'enforcedflairs',
    label: 'Enforce on Flairs (overrides post type)',
    helpText: 'Comma-separated flair keywords. Posts with these flairs ALWAYS require R5.',
    defaultValue: '',
  },
  {
    type: 'string',
    name: 'excludedflairs',
    label: 'Excluded Flairs (overrides post type)',
    helpText: 'Comma-separated flair keywords. Posts with these flairs NEVER require R5.',
    defaultValue: 'comic,art',
  },

  // ============================================================================
  // R5 Validation
  // ============================================================================
  {
    type: 'number',
    name: 'mincommentlength',
    label: 'Minimum R5 Comment Length',
    helpText: 'Minimum characters required for valid R5 comment',
    defaultValue: 50,
    onValidate: (value) => {
      const num = value as unknown as number;
      if (num < 10) return 'Minimum length must be at least 10 characters';
      if (num > 1000) return 'Minimum length cannot exceed 1000 characters';
    },
  },
  {
    type: 'number',
    name: 'reportcommentlength',
    label: 'Report R5 Comment Length',
    helpText: 'Comments below this length get reported (set equal to minimum to disable)',
    defaultValue: 75,
  },
  {
    type: 'paragraph',
    name: 'r5containsone',
    label: 'R5 Must Contain One Of (optional)',
    helpText: 'One per line. Example: "what", "why", "how", "because"',
    defaultValue: '',
  },
  {
    type: 'paragraph',
    name: 'r5containsall',
    label: 'R5 Must Contain All Of (optional)',
    helpText: 'One per line. Rare use case.',
    defaultValue: '',
  },
  {
    type: 'paragraph',
    name: 'r5startswith',
    label: 'R5 Must Start With (optional)',
    helpText: 'One per line. Example: "R5:", "Explanation:"',
    defaultValue: '',
  },
  {
    type: 'paragraph',
    name: 'r5endswith',
    label: 'R5 Must End With (optional)',
    helpText: 'One per line. Rare use case.',
    defaultValue: '',
  },
  {
    type: 'select',
    name: 'r5commentlocation',
    label: 'Where to Check for R5',
    helpText: 'Where should the bot look for the R5 explanation?',
    options: [
      { label: 'Text post body only', value: 'selftext' },
      { label: 'Parent comment by author only', value: 'comment' },
      { label: 'Text post body OR parent comment', value: 'both' },
    ],
    defaultValue: ['both'],
  },

  // ============================================================================
  // Timing
  // ============================================================================
  {
    type: 'number',
    name: 'graceperiod',
    label: 'Grace Period (minutes)',
    helpText: 'Minutes before first action (warning or removal)',
    defaultValue: 5,
    onValidate: (value) => {
      const num = value as unknown as number;
      if (num < 0) return 'Grace period cannot be negative';
      if (num > 1440) return 'Grace period cannot exceed 24 hours';
    },
  },
  {
    type: 'number',
    name: 'warningperiod',
    label: 'Warning Period (minutes)',
    helpText: 'Minutes after warning before removal. Set to 0 to remove without warning.',
    defaultValue: 10,
    onValidate: (value) => {
      const num = value as unknown as number;
      if (num < 0) return 'Warning period cannot be negative';
      if (num > 1440) return 'Warning period cannot exceed 24 hours';
    },
  },

  // ============================================================================
  // Bot Behavior
  // ============================================================================
  {
    type: 'select',
    name: 'enforcementaction',
    label: 'Enforcement Action',
    helpText: 'What should the bot do after grace/warning periods?',
    options: [
      { label: 'Remove posts', value: 'remove' },
      { label: 'Report posts only', value: 'report' },
      { label: 'Both remove and report', value: 'both' },
    ],
    defaultValue: ['remove'],
  },
  {
    type: 'boolean',
    name: 'commentonwarning',
    label: 'Comment on Warning',
    helpText: 'Post a comment when warning users about missing R5',
    defaultValue: true,
  },
  {
    type: 'boolean',
    name: 'commentonremoval',
    label: 'Comment on Removal',
    helpText: 'Post a comment when removing posts for missing R5',
    defaultValue: true,
  },

  // ============================================================================
  // Modmail Configuration
  // ============================================================================
  {
    type: 'boolean',
    name: 'enablemodmail',
    label: 'Enable Modmail Integration',
    helpText: 'Allow users to request reinstatement via modmail',
    defaultValue: true,
  },
  {
    type: 'string',
    name: 'modmailkeywords',
    label: 'Modmail Subject Keywords',
    helpText: 'Comma-separated keywords to trigger R5 reinstatement (e.g., "rule 5,r5,rule5")',
    defaultValue: 'rule 5,r5,rule5',
  },
  {
    type: 'boolean',
    name: 'autoarchivemodmail',
    label: 'Auto-Archive Successful Modmail',
    helpText: 'Automatically archive modmail conversations after successful reinstatement',
    defaultValue: true,
  },
  {
    type: 'boolean',
    name: 'autoreinstate',
    label: 'Auto-Reinstate When R5 Added',
    helpText: 'Automatically approve posts when valid R5 is added after removal',
    defaultValue: true,
  },
  {
    type: 'boolean',
    name: 'commentonreinstatement',
    label: 'Comment on Reinstatement',
    helpText: 'Post a comment when automatically reinstating posts',
    defaultValue: false,
  },

  // ============================================================================
  // Modmail Message Templates
  // ============================================================================
  {
    type: 'paragraph',
    name: 'modmailnopostid',
    label: 'Modmail: No Post ID Found',
    helpText: 'Message when user doesn\'t include a post ID/link',
    defaultValue: '❌ **Unable to process request**\n\nCould not find a valid post ID in your message. Please include a link to your post or the post ID.',
  },
  {
    type: 'paragraph',
    name: 'modmailpostnotfound',
    label: 'Modmail: Post Not Found',
    helpText: 'Message when post has been deleted. Variable: {{postid}}',
    defaultValue: '❌ **Post not found**\n\nThe post `{{postid}}` could not be found. It may have been deleted.',
  },
  {
    type: 'paragraph',
    name: 'modmailnotauthor',
    label: 'Modmail: Not Post Author',
    helpText: 'Message when requestor is not the post author',
    defaultValue: '❌ **Authorization failed**\n\nYou can only request reinstatement for your own posts.',
  },
  {
    type: 'paragraph',
    name: 'modmailnotbotremoval',
    label: 'Modmail: Not Bot Removal',
    helpText: 'Message when post was removed by human moderator, not bot',
    defaultValue: '❌ **This post was not removed by the bot**\n\nYour post was removed by a moderator, not the Rule 5 bot. Please contact the moderators directly for assistance.',
  },
  {
    type: 'paragraph',
    name: 'modmailalreadyapproved',
    label: 'Modmail: Already Approved',
    helpText: 'Message when post is already visible/approved',
    defaultValue: '✅ **Post is already approved**\n\nYour post is currently visible and has not been removed.',
  },
  {
    type: 'paragraph',
    name: 'modmailnor5',
    label: 'Modmail: No Valid R5',
    helpText: 'Message when user hasn\'t added valid R5. Variables: {{reason}}, {{minlength}}',
    defaultValue: '❌ **No valid Rule 5 comment found**\n\n{{reason}}\n\nPlease add a Rule 5 comment to your post before requesting reinstatement. Your comment must:\n- Be a top-level comment on the post\n- Be at least {{minlength}} characters long\n- Explain the context of your image/content',
  },
  {
    type: 'paragraph',
    name: 'modmailsuccess',
    label: 'Modmail: Reinstatement Success',
    helpText: 'Message when post is successfully reinstated. Variable: {{permalink}}',
    defaultValue: '✅ **Post reinstated successfully!**\n\nYour post has been approved and is now visible.\n\n[View your post]({{permalink}})',
  },
  {
    type: 'paragraph',
    name: 'modmailerror',
    label: 'Modmail: Processing Error',
    helpText: 'Message when an unexpected error occurs',
    defaultValue: '❌ **An error occurred**\n\nWe encountered an error while processing your request. Please contact the moderators directly.',
  },
  {
    type: 'paragraph',
    name: 'reinstatementcomment',
    label: 'Reinstatement Comment Template',
    helpText: 'Comment posted when auto-reinstating (if commentonreinstatement is enabled)',
    defaultValue: 'Thank you for adding Rule 5 context! Your post has been approved.',
  },

  // ============================================================================
  // Templates
  // ============================================================================
  {
    type: 'paragraph',
    name: 'warningtemplate',
    label: 'Warning Message Template',
    helpText: 'Variables: {{username}}, {{subreddit}}, {{warningminutes}}',
    defaultValue: `Hi /u/{{username}},

You have not yet added a rule #5 comment to your post:

> Explain what you want people to look at when you post a screenshot. Explanations should be posted as a reddit comment.

> View our full rules [here](https://reddit.com/r/{{subreddit}}/wiki/rules)

Since a rule #5 comment is mandatory, your post will be removed if you do not add this comment within {{warningminutes}} minutes.

You do not need to reply, modmail, or report if you've added a rule #5 comment; this comment will be deleted automatically.`,
  },
  {
    type: 'paragraph',
    name: 'removaltemplate',
    label: 'Removal Message Template',
    helpText: 'Variables: {{username}}, {{subreddit}}, {{modmaillink}}',
    defaultValue: `Hi /u/{{username}},

Your submission has been removed from /r/{{subreddit}} for breaking rule #5:

> Explain what you want people to look at when you post a screenshot. Explanations should be posted as a reddit comment.

> View our full rules [here](https://reddit.com/r/{{subreddit}}/wiki/rules)

If this was the only rule broken, we will reapprove your submission if you add background info.

Please [contact us through modmail]({{modmaillink}}) to get it reapproved.`,
  },
  {
    type: 'paragraph',
    name: 'reporttemplate',
    label: 'Report Message Template (Feature 5010)',
    helpText: 'Used when bot reports instead of removes. Variables: {{username}}, {{subreddit}}, {{action}}',
    defaultValue: `Hi /u/{{username}},

Your submission has been {{action}} for breaking rule #5:

> Explain what you want people to look at when you post a screenshot. Explanations should be posted as a reddit comment.

> View our full rules [here](https://reddit.com/r/{{subreddit}}/wiki/rules)

Please add a proper Rule 5 comment. Moderators will review your post.`,
  },
  {
    type: 'string',
    name: 'reportreason',
    label: 'Report Reason (Feature 5010)',
    helpText: 'Reason shown to moderators when reporting posts',
    defaultValue: 'Missing Rule 5 explanation after warning period',
  },

  // ============================================================================
  // Notifications
  // ============================================================================
  {
    type: 'boolean',
    name: 'enableslack',
    label: 'Enable Slack Notifications',
    helpText: 'Send notifications to Slack webhook',
    defaultValue: false,
  },
  {
    type: 'string',
    name: 'slackwebhook',
    label: 'Slack Webhook URL',
    helpText: 'Slack incoming webhook URL (https://hooks.slack.com/services/...)',
    defaultValue: '',
  },
  {
    type: 'boolean',
    name: 'enablediscord',
    label: 'Enable Discord Notifications',
    helpText: 'Send notifications to Discord webhook',
    defaultValue: false,
  },
  {
    type: 'string',
    name: 'discordwebhook',
    label: 'Discord Webhook URL',
    helpText: 'Discord webhook URL (https://discord.com/api/webhooks/...)',
    defaultValue: '',
  },
  {
    type: 'select',
    name: 'notificationevents',
    label: 'Notification Events',
    helpText: 'Which events should trigger notifications?',
    multiSelect: true,
    options: [
      { label: 'Warnings Issued', value: 'warning' },
      { label: 'Posts Removed', value: 'removal' },
      { label: 'Posts Reinstated', value: 'reinstatement' },
      { label: 'R5 Comments Reported', value: 'r5_report' },
      { label: 'Invalid R5 Comments', value: 'r5_invalid' },
      { label: 'Bot Errors', value: 'error' },
    ],
    defaultValue: ['removal', 'reinstatement'],
  },
];

