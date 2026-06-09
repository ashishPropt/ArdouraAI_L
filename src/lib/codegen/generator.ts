import { routedGenerate } from '@/lib/llm/router'
import { buildGeneratorPrompt, SYSTEM_PROMPT_GENERATOR } from './prompts'
import type { LLMMessage } from '@/lib/llm/providers/anthropic'

export interface GeneratedFile {
  path: string
  content: string
  language: string
}

export interface GeneratedProject {
  projectName: string
  description: string
  files: GeneratedFile[]
  setupCommands: string[]
  envVars: { key: string; description: string }[]
}

export async function generateProject(
  projectDescription: string,
  conversationHistory: LLMMessage[]
): Promise<GeneratedProject> {
  const conversationText = conversationHistory
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n')

  const prompt = buildGeneratorPrompt(projectDescription, conversationText)

  const { text } = await routedGenerate(
    [{ role: 'user', content: prompt }],
    SYSTEM_PROMPT_GENERATOR,
    'high'
  )

  // Extract JSON from response (may be wrapped in markdown code blocks)
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/)
  const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text

  try {
    const project = JSON.parse(jsonStr.trim()) as GeneratedProject
    return project
  } catch {
    // If JSON parse fails, create a minimal structure
    return {
      projectName: 'generated-app',
      description: projectDescription,
      files: [
        {
          path: 'README.md',
          content: `# Generated App\n\n${projectDescription}\n\nGeneration output:\n\n${text}`,
          language: 'markdown',
        },
      ],
      setupCommands: [],
      envVars: [],
    }
  }
}

export function detectLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase()
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java',
    css: 'css', scss: 'scss', html: 'html', json: 'json',
    md: 'markdown', sql: 'sql', sh: 'bash', env: 'bash',
    yml: 'yaml', yaml: 'yaml', toml: 'toml', prisma: 'prisma',
  }
  return map[ext || ''] || 'text'
}
