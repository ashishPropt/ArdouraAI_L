'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Megaphone, Sparkles, Video, Calendar, Send, Trash2, ExternalLink,
  Loader2, Twitter, Linkedin, MessageSquare, Mail, Rocket, Plus, Copy, Check, RefreshCw
} from 'lucide-react'

interface Project { id: string; name: string; description?: string; deployedUrl?: string }
interface Post { id: string; platform: string; content: string; status: string; scheduledAt?: string; publishedAt?: string; imageUrl?: string }
interface VideoItem { id: string; type: string; title: string; script: string; status: string; videoUrl?: string; thumbnailUrl?: string; durationSecs?: number; createdAt: string }

const PLATFORM_ICON: Record<string, JSX.Element> = {
  TWITTER:     <Twitter className="w-4 h-4 text-sky-400" />,
  LINKEDIN:    <Linkedin className="w-4 h-4 text-blue-400" />,
  REDDIT:      <MessageSquare className="w-4 h-4 text-orange-400" />,
  EMAIL:       <Mail className="w-4 h-4 text-green-400" />,
  PRODUCTHUNT: <Rocket className="w-4 h-4 text-red-400" />,
  INSTAGRAM:   <Sparkles className="w-4 h-4 text-pink-400" />,
}

const PLATFORM_COLOR: Record<string, string> = {
  TWITTER: 'border-sky-800/40 bg-sky-900/10',
  LINKEDIN: 'border-blue-800/40 bg-blue-900/10',
  REDDIT: 'border-orange-800/40 bg-orange-900/10',
  EMAIL: 'border-green-800/40 bg-green-900/10',
  PRODUCTHUNT: 'border-red-800/40 bg-red-900/10',
  INSTAGRAM: 'border-pink-800/40 bg-pink-900/10',
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-slate-700 text-slate-300',
  SCHEDULED: 'bg-blue-900 text-blue-300',
  PUBLISHED: 'bg-green-900 text-green-300',
  FAILED: 'bg-red-900 text-red-300',
}

export default function MarketingPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [tab, setTab] = useState<'posts' | 'videos' | 'calendar'>('posts')
  const [posts, setPosts] = useState<Post[]>([])
  const [videos, setVideos] = useState<VideoItem[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [editPost, setEditPost] = useState<Post | null>(null)

  useEffect(() => {
    fetch('/api/projects').then(r => r.json()).then(setProjects)
  }, [])

  const loadPosts = useCallback(async (projectId: string) => {
    setLoading(true)
    const res = await fetch(`/api/marketing/posts?projectId=${projectId}`)
    if (res.ok) setPosts(await res.json())
    setLoading(false)
  }, [])

  const loadVideos = useCallback(async (projectId: string) => {
    setLoading(true)
    const res = await fetch(`/api/marketing/videos?projectId=${projectId}`)
    if (res.ok) setVideos(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!selectedProject) return
    if (tab === 'posts' || tab === 'calendar') loadPosts(selectedProject.id)
    if (tab === 'videos') loadVideos(selectedProject.id)
  }, [selectedProject, tab, loadPosts, loadVideos])

  async function generatePosts() {
    if (!selectedProject) return
    setGenerating(true)
    const res = await fetch('/api/marketing/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: selectedProject.id, action: 'generate' }),
    })
    if (res.ok) await loadPosts(selectedProject.id)
    setGenerating(false)
  }

  async function generateCalendar() {
    if (!selectedProject) return
    setGenerating(true)
    await fetch('/api/marketing/calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: selectedProject.id }),
    })
    await loadPosts(selectedProject.id)
    setGenerating(false)
  }

  async function generateVideo(type: string) {
    if (!selectedProject) return
    setGenerating(true)
    await fetch('/api/marketing/videos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: selectedProject.id, type }),
    })
    await loadVideos(selectedProject.id)
    setGenerating(false)
  }

  async function publishPost(post: Post) {
    const res = await fetch(`/api/marketing/posts/${post.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'publish' }),
    })
    if (res.ok) await loadPosts(selectedProject!.id)
    else alert('No social account connected for this platform. Add it in Integrations.')
  }

  async function deletePost(id: string) {
    if (!confirm('Delete this post?')) return
    await fetch(`/api/marketing/posts/${id}`, { method: 'DELETE' })
    setPosts(p => p.filter(x => x.id !== id))
  }

  async function deleteVideo(id: string) {
    if (!confirm('Delete this video?')) return
    await fetch(`/api/marketing/videos/${id}`, { method: 'DELETE' })
    setVideos(v => v.filter(x => x.id !== id))
  }

  async function pollVideo(id: string) {
    const res = await fetch(`/api/marketing/videos/${id}`)
    if (res.ok) {
      const updated = await res.json()
      setVideos(v => v.map(x => x.id === id ? updated : x))
    }
  }

  function copy(text: string, id: string) {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-white">
            <Megaphone className="w-6 h-6 text-ardoura-400" /> Marketing Studio
          </h1>
          <p className="text-sm text-slate-400 mt-1">AI-generated content, videos, and social publishing for your apps</p>
        </div>
      </div>

      {/* Project selector */}
      <div className="mb-6">
        <label className="text-xs text-slate-400 mb-2 block">Select project to market</label>
        <select
          value={selectedProject?.id ?? ''}
          onChange={e => setSelectedProject(projects.find(p => p.id === e.target.value) ?? null)}
          className="border border-slate-700 rounded-lg px-3 py-2 bg-slate-800 text-white text-sm w-72"
        >
          <option value="">— choose a project —</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {!selectedProject ? (
        <div className="text-center py-20 border border-dashed border-slate-700 rounded-2xl">
          <Megaphone className="w-12 h-12 mx-auto mb-3 text-slate-600" />
          <p className="text-slate-400">Select a project to start generating marketing content</p>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex gap-1 mb-6 bg-slate-800/50 rounded-xl p-1 w-fit">
            {(['posts', 'videos', 'calendar'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${tab === t ? 'bg-ardoura-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                {t === 'posts' ? '📱 Posts' : t === 'videos' ? '🎬 Videos' : '📅 Calendar'}
              </button>
            ))}
          </div>

          {/* ── POSTS TAB ── */}
          {tab === 'posts' && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <button
                  onClick={generatePosts}
                  disabled={generating}
                  className="flex items-center gap-2 bg-ardoura-600 hover:bg-ardoura-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors"
                >
                  {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Generate Posts (All Platforms)
                </button>
                <span className="text-xs text-slate-500">AI writes Twitter, LinkedIn, Reddit & Product Hunt posts from your project description</span>
              </div>

              {loading ? (
                <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>
              ) : posts.length === 0 ? (
                <div className="text-center py-16 border border-dashed border-slate-700 rounded-2xl">
                  <Sparkles className="w-10 h-10 mx-auto mb-3 text-slate-600" />
                  <p className="text-slate-400 mb-3">No posts yet</p>
                  <button onClick={generatePosts} className="text-sm text-ardoura-400 hover:text-ardoura-300">Generate now →</button>
                </div>
              ) : (
                <div className="space-y-4">
                  {posts.map(post => (
                    <div key={post.id} className={`border rounded-2xl p-4 ${PLATFORM_COLOR[post.platform] ?? 'border-slate-700 bg-slate-800/30'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {PLATFORM_ICON[post.platform]}
                          <span className="text-sm font-semibold text-white">{post.platform}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[post.status]}`}>{post.status}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => copy(post.content, post.id)} className="text-slate-400 hover:text-white transition-colors p-1">
                            {copied === post.id ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                          </button>
                          {post.status !== 'PUBLISHED' && (
                            <button onClick={() => publishPost(post)} className="flex items-center gap-1 text-xs bg-green-800/40 hover:bg-green-700/40 text-green-300 px-3 py-1.5 rounded-lg transition-colors">
                              <Send className="w-3 h-3" /> Publish
                            </button>
                          )}
                          <button onClick={() => deletePost(post.id)} className="text-slate-600 hover:text-red-400 transition-colors p-1">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{post.content}</p>
                      {post.scheduledAt && (
                        <p className="text-[10px] text-slate-500 mt-2">Scheduled: {new Date(post.scheduledAt).toLocaleString()}</p>
                      )}
                      {post.publishedAt && (
                        <p className="text-[10px] text-green-500 mt-2">Published: {new Date(post.publishedAt).toLocaleString()}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── VIDEOS TAB ── */}
          {tab === 'videos' && (
            <div>
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                {(['DEMO', 'FEATURE', 'LAUNCH'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => generateVideo(type)}
                    disabled={generating}
                    className="flex items-center gap-2 border border-slate-600 hover:border-ardoura-500 disabled:opacity-50 text-slate-300 hover:text-white text-sm px-4 py-2 rounded-lg transition-colors"
                  >
                    {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
                    Generate {type} Video
                  </button>
                ))}
                <span className="text-xs text-slate-500">AI scripts + HeyGen renders a 60s avatar video</span>
              </div>

              {loading ? (
                <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>
              ) : videos.length === 0 ? (
                <div className="text-center py-16 border border-dashed border-slate-700 rounded-2xl">
                  <Video className="w-10 h-10 mx-auto mb-3 text-slate-600" />
                  <p className="text-slate-400 mb-2">No videos yet</p>
                  <p className="text-xs text-slate-600">Connect HeyGen in Integrations to enable AI avatar video rendering</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {videos.map(video => (
                    <div key={video.id} className="border border-slate-700 rounded-2xl overflow-hidden bg-slate-800/30">
                      {video.thumbnailUrl ? (
                        <img src={video.thumbnailUrl} alt={video.title} className="w-full h-40 object-cover" />
                      ) : (
                        <div className="w-full h-40 bg-slate-800 flex items-center justify-center">
                          {video.status === 'RENDERING' ? (
                            <div className="text-center">
                              <Loader2 className="w-8 h-8 animate-spin text-ardoura-400 mx-auto mb-2" />
                              <p className="text-xs text-slate-400">Rendering with HeyGen…</p>
                            </div>
                          ) : (
                            <Video className="w-10 h-10 text-slate-600" />
                          )}
                        </div>
                      )}
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-white">{video.title}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${video.status === 'READY' ? 'bg-green-900 text-green-300' : video.status === 'FAILED' ? 'bg-red-900 text-red-300' : 'bg-yellow-900 text-yellow-300'}`}>
                            {video.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-2 mb-3">{video.script}</p>
                        <div className="flex items-center gap-2">
                          {video.status === 'RENDERING' && (
                            <button onClick={() => pollVideo(video.id)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-white">
                              <RefreshCw className="w-3 h-3" /> Check status
                            </button>
                          )}
                          {video.videoUrl && (
                            <a href={video.videoUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-ardoura-400 hover:text-ardoura-300">
                              <ExternalLink className="w-3 h-3" /> Watch
                            </a>
                          )}
                          <button onClick={() => deleteVideo(video.id)} className="ml-auto text-slate-600 hover:text-red-400 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── CALENDAR TAB ── */}
          {tab === 'calendar' && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <button
                  onClick={generateCalendar}
                  disabled={generating}
                  className="flex items-center gap-2 bg-ardoura-600 hover:bg-ardoura-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors"
                >
                  {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
                  Generate 30-Day Calendar
                </button>
                <span className="text-xs text-slate-500">AI plans a full month of posts across all platforms</span>
              </div>

              {loading ? (
                <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>
              ) : posts.filter(p => p.scheduledAt).length === 0 ? (
                <div className="text-center py-16 border border-dashed border-slate-700 rounded-2xl">
                  <Calendar className="w-10 h-10 mx-auto mb-3 text-slate-600" />
                  <p className="text-slate-400 mb-3">No calendar yet</p>
                  <button onClick={generateCalendar} className="text-sm text-ardoura-400 hover:text-ardoura-300">Generate 30-day plan →</button>
                </div>
              ) : (
                <div className="space-y-2">
                  {posts.filter(p => p.scheduledAt).sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime()).map(post => (
                    <div key={post.id} className="flex items-start gap-3 border border-slate-800 rounded-xl p-3 hover:border-slate-700 transition-colors">
                      <div className="text-center min-w-[40px]">
                        <p className="text-[10px] text-slate-500">{new Date(post.scheduledAt!).toLocaleDateString('en', { month: 'short' })}</p>
                        <p className="text-lg font-bold text-white leading-none">{new Date(post.scheduledAt!).getDate()}</p>
                      </div>
                      <div className="flex items-center gap-2 mt-1">{PLATFORM_ICON[post.platform]}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-300 line-clamp-2">{post.content}</p>
                        <p className="text-[10px] text-slate-600 mt-1">{new Date(post.scheduledAt!).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_BADGE[post.status]}`}>{post.status}</span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => copy(post.content, post.id)} className="text-slate-600 hover:text-white p-1 transition-colors">
                          {copied === post.id ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                        <button onClick={() => deletePost(post.id)} className="text-slate-600 hover:text-red-400 p-1 transition-colors">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
