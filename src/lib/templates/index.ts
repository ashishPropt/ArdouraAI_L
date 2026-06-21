import type { GeneratedFile } from '@/lib/codegen/generator'

export interface ProjectTemplate {
  id: string
  name: string
  description: string
  icon: string
  tags: string[]
  files: GeneratedFile[]
  setupCommands: string[]
  envVars: { key: string; description: string }[]
}

export const TEMPLATES: ProjectTemplate[] = [
  {
    id: 'nextjs-saas',
    name: 'Next.js SaaS Starter',
    description: 'Full-stack SaaS with auth, dashboard, Stripe-ready billing, and Prisma DB.',
    icon: '⚡',
    tags: ['Next.js', 'TypeScript', 'Prisma', 'Tailwind'],
    setupCommands: ['npm install', 'npx prisma db push', 'npm run dev'],
    envVars: [
      { key: 'DATABASE_URL', description: 'PostgreSQL connection string' },
      { key: 'NEXTAUTH_SECRET', description: '32-char random secret' },
      { key: 'NEXTAUTH_URL', description: 'Your app URL e.g. http://localhost:3000' },
    ],
    files: [
      {
        path: 'package.json',
        language: 'json',
        content: JSON.stringify({
          name: 'nextjs-saas',
          version: '0.1.0',
          scripts: { dev: 'next dev', build: 'next build', start: 'next start' },
          dependencies: {
            next: '^14.2.0',
            react: '^18.3.0',
            'react-dom': '^18.3.0',
            'next-auth': '^5.0.0-beta.20',
            '@prisma/client': '^5.22.0',
            '@auth/prisma-adapter': '^2.7.0',
            bcryptjs: '^2.4.3',
          },
          devDependencies: {
            typescript: '^5',
            '@types/node': '^20',
            '@types/react': '^18',
            prisma: '^5.22.0',
            tailwindcss: '^3.4.0',
            autoprefixer: '^10.4.0',
            postcss: '^8.4.0',
          },
        }, null, 2),
      },
      {
        path: 'prisma/schema.prisma',
        language: 'prisma',
        content: `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String    @id @default(cuid())
  name          String?
  email         String    @unique
  emailVerified DateTime?
  image         String?
  password      String?
  plan          String    @default("free")
  createdAt     DateTime  @default(now())

  accounts Account[]
  sessions Session[]
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
`,
      },
      {
        path: 'src/app/layout.tsx',
        language: 'typescript',
        content: `import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'My SaaS',
  description: 'Built with ArdouraAI',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
`,
      },
      {
        path: 'src/app/page.tsx',
        language: 'typescript',
        content: `export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
      <div className="max-w-3xl text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-4">Welcome to My SaaS</h1>
        <p className="text-xl text-gray-600 mb-8">The fastest way to build your product.</p>
        <div className="flex gap-4 justify-center">
          <a href="/register" className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-semibold transition-colors">
            Get started
          </a>
          <a href="/login" className="border border-gray-300 hover:border-gray-400 text-gray-700 px-8 py-3 rounded-xl font-semibold transition-colors">
            Sign in
          </a>
        </div>
      </div>
    </main>
  )
}
`,
      },
      {
        path: 'src/app/dashboard/page.tsx',
        language: 'typescript',
        content: `import { auth } from '@/auth'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-2">Dashboard</h1>
      <p className="text-gray-600">Welcome back, {session.user?.name || session.user?.email}</p>
    </div>
  )
}
`,
      },
      {
        path: 'src/app/globals.css',
        language: 'css',
        content: `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n`,
      },
      {
        path: 'tailwind.config.ts',
        language: 'typescript',
        content: `import type { Config } from 'tailwindcss'
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
}
export default config
`,
      },
      {
        path: 'README.md',
        language: 'markdown',
        content: `# Next.js SaaS Starter

Generated by ArdouraAI.

## Setup

\`\`\`bash
npm install
cp .env.example .env.local
# Fill in your DATABASE_URL and NEXTAUTH_SECRET
npx prisma db push
npm run dev
\`\`\`
`,
      },
    ],
  },

  {
    id: 'react-spa',
    name: 'React SPA',
    description: 'Single-page React app with Vite, React Router, and Tailwind CSS.',
    icon: '⚛️',
    tags: ['React', 'Vite', 'TypeScript', 'Tailwind'],
    setupCommands: ['npm install', 'npm run dev'],
    envVars: [{ key: 'VITE_API_URL', description: 'Backend API base URL' }],
    files: [
      {
        path: 'package.json',
        language: 'json',
        content: JSON.stringify({
          name: 'react-spa',
          version: '0.1.0',
          type: 'module',
          scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
          dependencies: {
            react: '^18.3.0',
            'react-dom': '^18.3.0',
            'react-router-dom': '^6.26.0',
          },
          devDependencies: {
            '@vitejs/plugin-react': '^4.3.0',
            vite: '^5.4.0',
            typescript: '^5',
            '@types/react': '^18',
            '@types/react-dom': '^18',
            tailwindcss: '^3.4.0',
            autoprefixer: '^10.4.0',
            postcss: '^8.4.0',
          },
        }, null, 2),
      },
      {
        path: 'src/main.tsx',
        language: 'typescript',
        content: `import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
`,
      },
      {
        path: 'src/App.tsx',
        language: 'typescript',
        content: `import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import About from './pages/About'
import Navbar from './components/Navbar'

export default function App() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
      </Routes>
    </div>
  )
}
`,
      },
      {
        path: 'src/pages/Home.tsx',
        language: 'typescript',
        content: `export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] p-8 text-center">
      <h1 className="text-5xl font-bold text-gray-900 mb-4">Hello World</h1>
      <p className="text-xl text-gray-500">Your React SPA is ready. Start building!</p>
    </main>
  )
}
`,
      },
      {
        path: 'src/components/Navbar.tsx',
        language: 'typescript',
        content: `import { Link } from 'react-router-dom'

export default function Navbar() {
  return (
    <nav className="h-16 border-b border-gray-200 flex items-center px-6 gap-6">
      <Link to="/" className="font-bold text-gray-900">My App</Link>
      <Link to="/about" className="text-gray-500 hover:text-gray-900 transition-colors">About</Link>
    </nav>
  )
}
`,
      },
      { path: 'src/index.css', language: 'css', content: '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n' },
      {
        path: 'vite.config.ts',
        language: 'typescript',
        content: `import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\nexport default defineConfig({ plugins: [react()] })\n`,
      },
    ],
  },

  {
    id: 'express-api',
    name: 'Express REST API',
    description: 'Node.js REST API with Express, JWT auth, Prisma ORM, and Zod validation.',
    icon: '🚀',
    tags: ['Node.js', 'Express', 'TypeScript', 'Prisma'],
    setupCommands: ['npm install', 'npx prisma db push', 'npm run dev'],
    envVars: [
      { key: 'DATABASE_URL', description: 'PostgreSQL connection string' },
      { key: 'JWT_SECRET', description: '32-char random secret' },
      { key: 'PORT', description: 'Server port (default 3001)' },
    ],
    files: [
      {
        path: 'package.json',
        language: 'json',
        content: JSON.stringify({
          name: 'express-api',
          version: '0.1.0',
          scripts: { dev: 'tsx watch src/index.ts', build: 'tsc', start: 'node dist/index.js' },
          dependencies: {
            express: '^4.21.0',
            '@prisma/client': '^5.22.0',
            bcryptjs: '^2.4.3',
            jsonwebtoken: '^9.0.2',
            zod: '^3.23.8',
            cors: '^2.8.5',
            helmet: '^8.0.0',
          },
          devDependencies: {
            typescript: '^5',
            tsx: '^4.19.0',
            '@types/express': '^5',
            '@types/bcryptjs': '^2.4.6',
            '@types/jsonwebtoken': '^9.0.7',
            '@types/cors': '^2.8.17',
            prisma: '^5.22.0',
          },
        }, null, 2),
      },
      {
        path: 'src/index.ts',
        language: 'typescript',
        content: `import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { authRouter } from './routes/auth'
import { usersRouter } from './routes/users'

const app = express()
const PORT = process.env.PORT || 3001

app.use(helmet())
app.use(cors())
app.use(express.json())

app.get('/health', (_, res) => res.json({ status: 'ok' }))
app.use('/api/auth', authRouter)
app.use('/api/users', usersRouter)

app.listen(PORT, () => console.log(\`Server running on port \${PORT}\`))
`,
      },
      {
        path: 'src/lib/prisma.ts',
        language: 'typescript',
        content: `import { PrismaClient } from '@prisma/client'\nconst globalForPrisma = globalThis as unknown as { prisma: PrismaClient }\nexport const prisma = globalForPrisma.prisma || new PrismaClient()\nif (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma\n`,
      },
      {
        path: 'src/middleware/auth.ts',
        language: 'typescript',
        content: `import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface AuthRequest extends Request {
  userId?: string
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string }
    req.userId = payload.userId
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}
`,
      },
      {
        path: 'src/routes/auth.ts',
        language: 'typescript',
        content: `import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { prisma } from '../lib/prisma'

export const authRouter = Router()

const RegisterSchema = z.object({ email: z.string().email(), password: z.string().min(8) })

authRouter.post('/register', async (req, res) => {
  const parsed = RegisterSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  const { email, password } = parsed.data
  const exists = await prisma.user.findUnique({ where: { email } })
  if (exists) return res.status(409).json({ error: 'Email already in use' })
  const hash = await bcrypt.hash(password, 12)
  const user = await prisma.user.create({ data: { email, password: hash } })
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' })
  res.status(201).json({ token, user: { id: user.id, email: user.email } })
})

authRouter.post('/login', async (req, res) => {
  const parsed = RegisterSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  const { email, password } = parsed.data
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !user.password) return res.status(401).json({ error: 'Invalid credentials' })
  const valid = await bcrypt.compare(password, user.password)
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' })
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' })
  res.json({ token, user: { id: user.id, email: user.email } })
})
`,
      },
      {
        path: 'src/routes/users.ts',
        language: 'typescript',
        content: `import { Router } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth'
import { prisma } from '../lib/prisma'

export const usersRouter = Router()

usersRouter.get('/me', authenticate, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } })
  if (!user) return res.status(404).json({ error: 'Not found' })
  res.json({ id: user.id, email: user.email, createdAt: user.createdAt })
})
`,
      },
      {
        path: 'prisma/schema.prisma',
        language: 'prisma',
        content: `generator client {
  provider = "prisma-client-js"
}
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String?
  createdAt DateTime @default(now())
}
`,
      },
    ],
  },

  {
    id: 'fastapi-python',
    name: 'FastAPI Python',
    description: 'Python REST API with FastAPI, SQLAlchemy, Alembic migrations, and JWT auth.',
    icon: '🐍',
    tags: ['Python', 'FastAPI', 'SQLAlchemy', 'PostgreSQL'],
    setupCommands: ['pip install -r requirements.txt', 'alembic upgrade head', 'uvicorn app.main:app --reload'],
    envVars: [
      { key: 'DATABASE_URL', description: 'PostgreSQL connection string' },
      { key: 'SECRET_KEY', description: '32-char random secret for JWT' },
    ],
    files: [
      {
        path: 'requirements.txt',
        language: 'text',
        content: `fastapi==0.115.0
uvicorn[standard]==0.31.0
sqlalchemy==2.0.35
alembic==1.13.3
psycopg2-binary==2.9.9
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-dotenv==1.0.1
pydantic[email]==2.9.2
`,
      },
      {
        path: 'app/main.py',
        language: 'python',
        content: `from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, users

app = FastAPI(title="My API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/users", tags=["users"])

@app.get("/health")
def health():
    return {"status": "ok"}
`,
      },
      {
        path: 'app/database.py',
        language: 'python',
        content: `from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:pass@localhost/db")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
`,
      },
      {
        path: 'app/models.py',
        language: 'python',
        content: `from sqlalchemy import Column, String, DateTime, func
from app.database import Base
import uuid

class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
`,
      },
      {
        path: 'app/routers/auth.py',
        language: 'python',
        content: `from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta
import os
from app.database import get_db
from app import models

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = os.getenv("SECRET_KEY", "changeme")

class RegisterIn(BaseModel):
    email: EmailStr
    password: str

def make_token(user_id: str) -> str:
    return jwt.encode(
        {"sub": user_id, "exp": datetime.utcnow() + timedelta(days=7)},
        SECRET_KEY, algorithm="HS256"
    )

@router.post("/register", status_code=201)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    if db.query(models.User).filter_by(email=body.email).first():
        raise HTTPException(409, "Email already in use")
    user = models.User(email=body.email, hashed_password=pwd_context.hash(body.password))
    db.add(user); db.commit(); db.refresh(user)
    return {"token": make_token(user.id), "user": {"id": user.id, "email": user.email}}

@router.post("/login")
def login(body: RegisterIn, db: Session = Depends(get_db)):
    user = db.query(models.User).filter_by(email=body.email).first()
    if not user or not pwd_context.verify(body.password, user.hashed_password):
        raise HTTPException(401, "Invalid credentials")
    return {"token": make_token(user.id), "user": {"id": user.id, "email": user.email}}
`,
      },
      {
        path: 'app/routers/users.py',
        language: 'python',
        content: `from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from jose import jwt, JWTError
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import os
from app.database import get_db
from app import models

router = APIRouter()
bearer = HTTPBearer()
SECRET_KEY = os.getenv("SECRET_KEY", "changeme")

def current_user(creds: HTTPAuthorizationCredentials = Depends(bearer), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(creds.credentials, SECRET_KEY, algorithms=["HS256"])
        user = db.query(models.User).get(payload["sub"])
        if not user: raise HTTPException(401)
        return user
    except JWTError:
        raise HTTPException(401, "Invalid token")

@router.get("/me")
def me(user=Depends(current_user)):
    return {"id": user.id, "email": user.email, "created_at": user.created_at}
`,
      },
      { path: 'app/__init__.py', language: 'python', content: '' },
      { path: 'app/routers/__init__.py', language: 'python', content: '' },
    ],
  },
]

export function getTemplate(id: string): ProjectTemplate | undefined {
  return TEMPLATES.find(t => t.id === id)
}
