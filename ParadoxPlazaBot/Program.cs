using RedditSharp;
using RedditSharp.Things;
using System;
using System.Collections.Generic;
using System.Linq;
using static RedditSharp.Things.VotableThing;

namespace ParadoxPlazaBot
{
    public class Program
    {
        public static string MessageWarn = "Hi {0}. Your submission will be removed within 5 minutes from {1} because:  " + Environment.NewLine +
            "Rule 5:  " + Environment.NewLine +
            "Explain what you want people to look at when you post a screenshot. Explanations should be posted as a comment, by the original author.";

        public static string MessageRemove = "Hi {0}. Your submission has been removed from {1} because:  " + Environment.NewLine +
                "It broke Rule 5:  " + Environment.NewLine +
                "Explain what you want people to look at when you post a screenshot. Explanations should be posted as a comment, by the original author." + Environment.NewLine +
                "Your submission can be approved if you explain what the point of this image is. Please send us a modmail (do not reply to this bot) and let us know when you have added an explanatory comment about what people are supposed to see.";

        public static void Main(string[] args)
        {
            var now = DateTime.UtcNow;
            var checkMoment1 = now.AddMinutes(-5);
            var checkMoment2 = now.AddMinutes(-10);
            var reddit = new Reddit();

            var user = reddit.LogIn("paradoxplazabot", "", true);

            var subreddits = new[] {
                //reddit.GetSubreddit("/r/eu4"),
                //reddit.GetSubreddit("/r/paradoxplaza"),
                //reddit.GetSubreddit("/r/Stellaris"),
                //reddit.GetSubreddit("/r/hoi4"),
                //reddit.GetSubreddit("/r/victoria2"),
                //reddit.GetSubreddit("/r/TyrannyGame")
                reddit.GetSubreddit("/r/paradoxplayground")
            };

            foreach (var subreddit in subreddits)
            {
                foreach (var post in subreddit.New.Take(25))
                {
                    // Post is at least 5 minutes old
                    if (!post.IsSelfPost &&
                        string.IsNullOrWhiteSpace(post.ApprovedBy) &&
                        post.CreatedUTC < checkMoment1)
                    {
                        var comments = new List<Comment>(post.Comments);

                        // Original Author has not posted yet
                        if (!comments.Any(c => Equals(c.Author, post.Author.Name)))
                        {

                            // Post is at least 10 minutes old, and paradoxbot has warned once. Remove post.
                            if (post.CreatedUTC < checkMoment2 && comments.Any(c => Equals(c.Author, "paradoxplazabot")))
                            {
                                // Inform the user about what happened
                                var comment = post.Comment(string.Format(MessageRemove, post.Author, subreddit.Name));
                                comment.Distinguish(DistinguishType.Moderator);
                                comment.IsStickied = true;

                                // Remove the post.
                                post.Remove();
                            }
                            // Post is less then 10 minutes old and has no warning. 
                            else if (!comments.Any(c => Equals(c.Author, "paradoxplazabot")))
                            {
                                // Warn the user about what will happen.
                                var comment = post.Comment(string.Format(MessageWarn, post.Author, subreddit.Name));
                                comment.Distinguish(DistinguishType.Moderator);
                                comment.IsStickied = true;
                            }
                        }
                        // Original Author has commented. Remove bot posts.
                        else
                            foreach (var comment in comments.Where(c => Equals(c.Author, "paradoxplazabot")))
                                comment.Del();
                    }
                }
            }
        }
    }
}
