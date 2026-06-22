import { routedGenerate } from '@/lib/llm/router'

const MARKETING_SYSTEM = `You are an expert startup marketer specializing in developer tools and SaaS products.
Write punchy, authentic copy that resonates with technical founders, developers, and CTOs.
Never use generic buzzwords. Be specific, concrete, and benefit-focused.`

interface ProjectContext {
  name: string
  description?: string | null
  deployedUrl?: string | null
  stack?: string
}

// Generate platform-specific social posts for a project
export async function generateSocialPosts(project: ProjectContext): Promise<Record<string, string>> {
  const prompt = `Generate social media launch posts for this app:
App name: ${project.name}
Description: ${project.description ?? 'A new web application'}
Live URL: ${project.deployedUrl ?? 'coming soon'}
Stack: ${project.stack ?? 'modern web stack'}

Generate one post for each platform (return as JSON):
- twitter: max 280 chars, punchy, include URL, 2-3 hashtags
- twitter_thread: array of 4 tweets telling the build story
- linkedin: 150-200 words, professional, include 3 bullet points of key features, end with CTA
- reddit: 200-300 words in r/SaaS style, authentic, explain the problem solved, no hype
- producthunt_tagline: under 60 chars, benefit-focused
- producthunt_description: 200-250 words for PH submission

Return ONLY valid JSON, no markdown.`

  const { text } = await routedGenerate(
    [{ role: 'user', content: prompt }],
    MARKETING_SYSTEM,
    'medium'
  )

  try {
    const clean = text.replace(/```json\n?|\n?```/g, '').trim()
    return JSON.parse(clean)
  } catch {
    return { twitter: text.slice(0, 280), linkedin: text, reddit: text, producthunt_tagline: project.name }
  }
}

// Generate a HeyGen video script
export async function generateVideoScript(project: ProjectContext, type: 'DEMO' | 'FEATURE' | 'LAUNCH'): Promise<string> {
  const typeContext = {
    DEMO: 'a 60-second product demo showing how the app works step by step',
    FEATURE: 'a 45-second feature highlight focusing on the most impressive capability',
    LAUNCH: 'a 60-second launch announcement building excitement and driving signups',
  }[type]

  const prompt = `Write ${typeContext} video script for an AI avatar presenter.

App: ${project.name}
Description: ${project.description ?? 'A new web application'}
URL: ${project.deployedUrl ?? ''}

Requirements:
- Written as spoken word for an AI avatar (natural, conversational)
- Start with a hook that grabs attention in the first 5 seconds
- Include a clear call-to-action at the end
- No technical jargon unless necessary
- Energetic but not salesy
- Approximately 120-150 words for 60 seconds

Return ONLY the script text, no stage directions or formatting.`

  const { text } = await routedGenerate(
    [{ role: 'user', content: prompt }],
    MARKETING_SYSTEM,
    'medium'
  )
  return text.trim()
}

// Generate a 30-day content calendar
export async function generateContentCalendar(project: ProjectContext): Promise<Array<{
  day: number
  platform: string
  theme: string
  content: string
  scheduledTime: string
}>> {
  const prompt = `Create a 30-day social media content calendar for this app:
App: ${project.name}
Description: ${project.description ?? 'A new web application'}
URL: ${project.deployedUrl ?? ''}

Structure:
- Week 1 (days 1-7): Launch week — announcement, behind-the-scenes, features
- Week 2 (days 8-14): Education — how it works, use cases, tutorials
- Week 3 (days 15-21): Social proof — user wins, testimonial templates, metrics
- Week 4 (days 22-30): Growth — product updates, comparisons, community building

For each post include: day (1-30), platform (twitter/linkedin/reddit), theme (2-3 words), brief content (1-2 sentences describing what to post), scheduledTime (e.g. "9:00 AM").

Return as JSON array. Maximum 20 posts total (select best days). Return ONLY valid JSON, no markdown.`

  const { text } = await routedGenerate(
    [{ role: 'user', content: prompt }],
    MARKETING_SYSTEM,
    'medium'
  )

  try {
    const clean = text.replace(/```json\n?|\n?```/g, '').trim()
    return JSON.parse(clean)
  } catch {
    return []
  }
}

// Generate email launch sequence
export async function generateEmailSequence(project: ProjectContext): Promise<Array<{
  day: number
  subject: string
  preview: string
  body: string
}>> {
  const prompt = `Write a 5-email launch drip sequence for new signups of this app:
App: ${project.name}
Description: ${project.description ?? 'A new web application'}

Emails:
1. Day 0 — Welcome + quick start (get them to first win)
2. Day 2 — Key feature highlight (the most impressive thing the app does)
3. Day 5 — Use case / success story template (inspire them)
4. Day 10 — Tips and power user tricks
5. Day 14 — Upgrade nudge (if on free tier, soft sell to paid)

For each: day, subject (under 50 chars), preview text (under 90 chars), body (200-250 words, plain text style).

Return ONLY valid JSON array, no markdown.`

  const { text } = await routedGenerate(
    [{ role: 'user', content: prompt }],
    MARKETING_SYSTEM,
    'medium'
  )

  try {
    const clean = text.replace(/```json\n?|\n?```/g, '').trim()
    return JSON.parse(clean)
  } catch {
    return []
  }
}
