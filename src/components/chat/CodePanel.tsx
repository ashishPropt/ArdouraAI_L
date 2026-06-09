'use client'

import { useState } from 'react'
import { ChevronRight, File, Folder } from 'lucide-react'
import { detectLanguage } from '@/lib/codegen/generator'

interface ProjectFile {
  id: string
  path: string
  content: string
  language: string | null
}

interface Props {
  files: ProjectFile[]
  selectedFile: ProjectFile | null
  onSelectFile: (file: ProjectFile) => void
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
  node,
  depth,
  selectedFile,
  onSelect,
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

export function CodePanel({ files, selectedFile, onSelectFile }: Props) {
  const tree = buildTree(files)

  return (
    <div className="flex h-full bg-slate-900">
      {/* File tree */}
      <div className="w-52 flex-shrink-0 border-r border-slate-800 overflow-y-auto py-2">
        <div className="px-3 pb-2">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Files</p>
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
            <div className="px-4 py-2 border-b border-slate-800 flex items-center gap-2">
              <File className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-xs text-slate-300 font-mono">{selectedFile.path}</span>
              <span className="ml-auto text-xs text-slate-600">
                {selectedFile.language || detectLanguage(selectedFile.path)}
              </span>
            </div>
            <div className="flex-1 overflow-auto">
              <pre className="p-4 text-xs text-slate-300 font-mono leading-relaxed whitespace-pre">
                {selectedFile.content}
              </pre>
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
