import axios from 'axios'

interface HeyGenConfig {
  apiKey: string
}

interface GenerateVideoParams {
  script: string
  avatarId?: string
  voiceId?: string
  title?: string
}

interface CheckStatusParams {
  videoId: string
}

export async function executeHeyGen(
  action: string,
  params: Record<string, unknown>,
  config: HeyGenConfig
) {
  const client = axios.create({
    baseURL: 'https://api.heygen.com/v2',
    headers: { 'X-Api-Key': config.apiKey, 'Content-Type': 'application/json' },
    timeout: 30_000,
  })

  switch (action) {
    case 'generate_video': {
      const p = params as unknown as GenerateVideoParams
      const res = await client.post('/video/generate', {
        video_inputs: [{
          character: {
            type: 'avatar',
            avatar_id: p.avatarId ?? 'Daisy-inskirt-20220818',
            avatar_style: 'normal',
          },
          voice: {
            type: 'text',
            input_text: p.script,
            voice_id: p.voiceId ?? '2d5b0e6cf36f460aa7fc47e3eee4ba54',
          },
          background: { type: 'color', value: '#0f172a' },
        }],
        test: false,
        caption: true,
        title: p.title ?? 'ArdouraAI Demo',
        dimension: { width: 1280, height: 720 },
      })
      return { success: true, data: { videoId: res.data.data?.video_id, status: 'RENDERING' } }
    }

    case 'check_video_status': {
      const p = params as unknown as CheckStatusParams
      const res = await client.get(`/video/${p.videoId}`)
      const v = res.data.data
      return {
        success: true,
        data: {
          videoId: p.videoId,
          status: v?.status === 'completed' ? 'READY' : v?.status === 'failed' ? 'FAILED' : 'RENDERING',
          videoUrl: v?.video_url ?? null,
          thumbnailUrl: v?.thumbnail_url ?? null,
          durationSecs: v?.duration ? Math.round(v.duration) : null,
        },
      }
    }

    case 'list_avatars': {
      const res = await client.get('/avatars')
      return { success: true, data: res.data.data?.avatars ?? [] }
    }

    case 'list_voices': {
      const res = await client.get('/voices')
      return { success: true, data: res.data.data?.voices ?? [] }
    }

    default:
      return { success: false, error: `Unknown HeyGen action: ${action}` }
  }
}
