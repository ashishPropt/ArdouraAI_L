import Link from 'next/link'
import { ArrowRight, Code2, Cpu, Github, Globe, Layers, Zap } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-ardoura-950 via-ardoura-900 to-slate-900 text-white">
      {/* Nav */}
      <nav className="container mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-ardoura-500 rounded-lg flex items-center justify-center">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">ArdouraAI</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm text-ardoura-200 hover:text-white transition-colors">
            Sign in
          </Link>
          <Link
            href="/register"
            className="bg-ardoura-500 hover:bg-ardoura-400 text-white text-sm px-4 py-2 rounded-lg transition-colors font-medium"
          >
            Get started free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="container mx-auto px-6 pt-20 pb-28 text-center">
        <div className="inline-flex items-center gap-2 bg-ardoura-800/50 border border-ardoura-700/50 rounded-full px-4 py-1.5 text-sm text-ardoura-300 mb-8">
          <Zap className="w-3.5 h-3.5" />
          Powered by Claude, GPT-4 & Gemini
        </div>
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-tight">
          Turn ideas into{' '}
          <span className="bg-gradient-to-r from-ardoura-400 to-purple-400 bg-clip-text text-transparent">
            full-stack apps
          </span>
        </h1>
        <p className="text-xl text-ardoura-200 max-w-2xl mx-auto mb-10 leading-relaxed">
          Chat about your business idea and ArdouraAI will generate a complete, production-ready
          application — then deploy it to your own server.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/register"
            className="bg-ardoura-500 hover:bg-ardoura-400 text-white px-8 py-3.5 rounded-xl font-semibold text-lg transition-all hover:scale-105 flex items-center gap-2"
          >
            Start building <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            href="/login"
            className="border border-ardoura-700 hover:border-ardoura-500 text-ardoura-200 hover:text-white px-8 py-3.5 rounded-xl font-semibold text-lg transition-all"
          >
            Sign in
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-6 pb-24 grid md:grid-cols-3 gap-6">
        {[
          {
            icon: <Cpu className="w-6 h-6" />,
            title: 'Multi-LLM Generation',
            description: 'Automatically routes to the best and most cost-effective AI model for each task.',
          },
          {
            icon: <Github className="w-6 h-6" />,
            title: 'GitHub Integration',
            description: 'Generated code is automatically pushed to your GitHub. No copy-pasting.',
          },
          {
            icon: <Globe className="w-6 h-6" />,
            title: 'One-Click Deploy',
            description: 'Deploy to Vultr VPS with one click. Use your account or create a new one.',
          },
          {
            icon: <Code2 className="w-6 h-6" />,
            title: 'Full-Stack Apps',
            description: 'Generates React frontends, Node.js backends, databases, and Docker configs.',
          },
          {
            icon: <Layers className="w-6 h-6" />,
            title: 'Iterative Building',
            description: 'Chat to refine, add features, fix bugs — the AI remembers your full project.',
          },
          {
            icon: <Zap className="w-6 h-6" />,
            title: 'Cost Optimized',
            description: 'Smart routing uses cheaper models when possible — saving you AI credits.',
          },
        ].map((f, i) => (
          <div key={i} className="bg-ardoura-900/40 border border-ardoura-800/50 rounded-2xl p-6 hover:border-ardoura-600/50 transition-colors">
            <div className="w-12 h-12 bg-ardoura-800 rounded-xl flex items-center justify-center mb-4 text-ardoura-400">
              {f.icon}
            </div>
            <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
            <p className="text-ardoura-300 text-sm leading-relaxed">{f.description}</p>
          </div>
        ))}
      </section>

      {/* CTA */}
      <section className="container mx-auto px-6 pb-20 text-center">
        <div className="bg-gradient-to-r from-ardoura-800/50 to-purple-900/30 border border-ardoura-700/50 rounded-3xl p-12">
          <h2 className="text-3xl font-bold mb-4">Ready to build your app?</h2>
          <p className="text-ardoura-300 mb-8">Join hundreds of entrepreneurs building with AI.</p>
          <Link
            href="/register"
            className="bg-ardoura-500 hover:bg-ardoura-400 text-white px-10 py-4 rounded-xl font-semibold text-lg transition-all hover:scale-105 inline-flex items-center gap-2"
          >
            Start for free <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      <footer className="container mx-auto px-6 py-8 border-t border-ardoura-800/50 text-center text-ardoura-500 text-sm">
        © 2026 ArdouraAI. Built with love and AI.
      </footer>
    </div>
  )
}
