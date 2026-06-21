'use client'

import { useState, useCallback } from 'react'
import { ChevronRight, File, Folder, Edit3, Copy, Check, X, Loader2 } from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { detectLanguage } from '@/lib/codegen/generator'

interface ProjectFile {
  id: string
  path: string
  content: string
  language: string | null
}

interface Props {
  projectId: string
  files: ProjectFile[]
  selectedFile: ProjectFile | null
  onSelectFile: (file: ProjectFile) => void
  onFileUpdated?: (file: ProjectFile) => void
}

interface TreeNode {
  name: string
  path: string
  isFile: boolean
  file?: ProjectFile
  children: Record<string, TreeNode>
}

function buildTree(files: ProjectFile[]): TreeNode {
  const root: TreeNode = { name: '', path: '', isFile: false, children: {} }
  for (const file of files) {
    const parts = file.path.split('/')
    let node = root
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isLast = i === parts.length - 1
      if (!node.children[part]) {
        node.children[part] = {
          name: part,
          path: parts.slice(0, i + 1).join('/'),
          isFile: isLast,
          file: isLast ? file : undefined,
          children: {},
        }
      }
      node = node.children[part]
    }
  }
  return root
}

function TreeItem({
  node, depth, selectedFile, onSelect,
}: {
  node: TreeNode
  depth: number
  selectedFile: ProjectFile | null
  onSelect: (file: ProjectFile) => void
}) {
  const [open, setOpen] = useState(depth < 2)

  if (node.isFile && node.file) {
    return (
      <button
        onClick={() => onSelect(node.file!)}
        className={`w-full flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-colors ${
          selectedFile?.id === node.file.id
            ? 'bg-ardoura-800/60 text-ardoura-300'
            : 'text-slate-400 hover:text-white hover:bg-slate-800'
        }`}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
      >
        <File className="w-3 h-3 flex-shrink-0" />
        <span className="truncate">{node.name}</span>
      </button>
    )
  }

  return (
    <div>
      {node.name && (
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center gap-1.5 px-2 py-1 text-xs text-slate-500 hover:text-white hover:bg-slate-800 rounded transition-colors"
          style={{ paddingLeft: `${8 + depth * 12}px` }}
        >
          <ChevronRight className={`w-3 h-3 flex-shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
          <Folder className="w-3 h-3 flex-shrink-0" />
          <span>{node.name}</span>
        </button>
      )}
      {(open || !node.name) &&
        Object.values(node.children)
          .sort((a, b) => (a.isFile ? 1 : -1) - (b.isFile ? 1 : -1) || a.name.localeCompare(b.name))
          .map((child) => (
            <TreeItem
              key={child.path}
              node={child}
              depth={node.name ? depth + 1 : depth}
              selectedFile={selectedFile}
              onSelect={onSelect}
            />
          ))}
    </div>
  )
}

function DiffLine({ line }: { line: string }) {
  if (line.startsWith('+') && !line.startsWith('+++')) {
    return <div className="bg-green-950/60 text-green-300 px-4 py-0.5 font-mono text-xs whitespace-pre">{line}</div>
  }
  if (line.startsWith('-') && !line.startsWith('---')) {
    return <div className="bg-red-950/60 text-red-300 px-4 py-0.5 font-mono text-xs whitespace-pre">{line}</div>
  }
  if (line.startsWith('@@')) {
    return <div className="bg-blue-950/60 text-blue-400 px-4 py-0.5 font-mono text-xs whitespace-pre">{line}</div>
  }
  return <div className="text-slate-400 px-4 py-0.5 font-mono text-xs whitespace-pre">{line}</div>
}

export function CodePanel({ projectId, files, selectedFile, onSelectFile, onFileUpdated }: Props) {
  const tree = buildTree(files)
  const [copied, setCopied] = useState(false)
  const [showEditBar, setShowEditBar] = useState(false)
  const [editInstruction, setEditInstruction] = useState('')
  const [editing, setEditing] = useState(false)
  const [diff, setDiff] = useState<string | null>(null)
  const [pendingContent, setPendingContent] = useState<string | null>(null)

  const lang = selectedFile
    ? (selectedFile.language || detectLanguage(selectedFile.path))
    : 'text'

  const copyFile = useCallback(async () => {
    if (!selectedFile) return
    await navigator.clipboard.writeText(selectedFile.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [selectedFile])

  async function runEdit() {
    if (!selectedFile || !editInstruction.trim()) return
    setEditing(true)
    setDiff(null)
    setPendingContent(null)

    try {
      const res = await fetch('/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          filePath: selectedFile.path,
          instruction: editInstruction,
          currentContent: selectedFile.content,
        }),
      })

      if (!res.body) throw new Error('No response body')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let newContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = JSON.parse(line.slice(6))
          if (data.type === 'chunk') newContent += data.text
          if (data.type === 'complete') {
            newContent = data.content
            setDiff(data.diff ?? null)
            setPendingContent(newContent)
          }
        }
      }
    } catch (err) {
      console.error('Edit error:', err)
    } finally {
      setEditing(false)
    }
  }

  function applyEdit() {
    if (!selectedFile || !pendingContent) return
    onFileUpdated?.({ ...selectedFile, content: pendingContent })
    setDiff(null)
    setPendingContent(null)
    setShowEditBar(false)
    setEditInstruction('')
  }

  function discardEdit() {
    setDiff(null)
    setPendingContent(null)
  }

  return (
    <div className="flex h-full bg-slate-900">
      {/* File tree */}
      <div className="w-52 flex-shrink-0 border-r border-slate-800 overflow-y-auto py-2">
        <div className="px-3 pb-2">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Files ({files.length})</p>
        </div>
        {files.length === 0 ? (
          <p className="px-3 text-xs text-slate-600 italic">No files yet — chat to generate</p>
        ) : (
          <TreeItem node={tree} depth={0} selectedFile={selectedFile} onSelect={onSelectFile} />
        )}
      </div>

      {/* Code viewer */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedFile ? (
          <>
            {/* Header */}
            <div className="px-4 py-2 border-b border-slate-800 flex items-center gap-2 flex-shrink-0">
              <File className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-xs text-slate-300 font-mono flex-1 truncate">{selectedFile.path}</span>
              <span className="text-xs text-slate-600 mr-2">{lang}</span>
              <button
                onClick={() => setShowEditBar(!showEditBar)}
                title="Edit with AI"
                className={`p-1 rounded transition-colors ${showEditBar ? 'text-ardoura-400 bg-ardoura-900/40' : 'text-slate-500 hover:text-white'}`}
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={copyFile}
                title="Copy"
                className="p-1 rounded text-slate-500 hover:text-white transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* AI Edit bar */}
            {showEditBar && (
              <div className="border-b border-slate-800 px-3 py-2 flex gap-2 items-center bg-slate-800/40 flex-shrink-0">
                <Edit3 className="w-3.5 h-3.5 text-ardoura-400 flex-shrink-0" />
                <input
                  type="text"
                  value={editInstruction}
                  onChange={e => setEditInstruction(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && runEdit()}
                  placeholder="Describe what to change in this file…"
                  className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none"
                  disabled={editing}
                />
                {editing ? (
                  <Loader2 className="w-4 h-4 animate-spin text-ardoura-400" />
                ) : (
                  <button
                    onClick={runEdit}
                    disabled={!editInstruction.trim()}
                    className="text-xs bg-ardoura-600 hover:bg-ardoura-500 disabled:opacity-40 text-white px-3 py-1 rounded-lg transition-colors"
                  >
                    Edit
                  </button>
                )}
              </div>
            )}

            {/* Diff / Apply bar */}
            {diff && pendingContent && (
              <div className="border-b border-slate-800 px-3 py-2 flex items-center gap-3 bg-slate-800/60 flex-shrink-0">
                <span className="text-xs text-slate-400 flex-1">AI proposed changes — review diff below</span>
                <button onClick={applyEdit} className="text-xs bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded-lg transition-colors">Apply</button>
                <button onClick={discardEdit} className="text-xs border border-slate-600 hover:border-slate-400 text-slate-400 hover:text-white px-3 py-1 rounded-lg transition-colors flex items-center gap-1">
                  <X className="w-3 h-3" /> Discard
                </button>
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-auto">
              {diff ? (
                <div className="py-2">
                  {diff.split('\n').map((line, i) => <DiffLine key={i} line={line} />)}
                </div>
              ) : (
                <SyntaxHighlighter
                  language={lang === 'typescript' ? 'tsx' : lang}
                  style={vscDarkPlus}
                  customStyle={{
                    margin: 0,
                    padding: '1rem',
                    background: 'transparent',
                    fontSize: '0.75rem',
                    lineHeight: '1.6',
                    height: '100%',
                  }}
                  showLineNumbers
                  lineNumberStyle={{ color: '#374151', minWidth: '2.5em' }}
                >
                  {selectedFile.content}
                </SyntaxHighlighter>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-600 text-sm">
            Select a file to view
          </div>
        )}
      </div>
    </div>
  )
}
