# 🎨 PROMPT PARA SESSÃO WEB INTERFACE (Frontend)

## Contexto Geral
Você está trabalhando no **FazAI v4.0 Web Interface**, uma interface web moderna para gerenciar o Terminal Jarvis. Sua responsabilidade é criar um **dashboard Next.js** que permita:
1. Visualizar e editar **personality traits** do agente
2. Monitorar **learning outcomes** (acertos/erros)
3. Ver **cache statistics** e performance
4. Gerenciar **collections Qdrant**
5. Interface para **AutoGPT autonomous mode**

## Arquitetura Web

```
Next.js 14+ (App Router)
        ↓
    React Server Components
        ↓
    API Routes (REST)
        ↓
    FazAI Core (TypeScript)
        ↓
    Qdrant Vector DB
```

## 📋 Suas Tarefas (Fase 1 + 2)

### FASE 1: Setup + Dashboard Base (2 dias)

#### 1.1 Criar Projeto Next.js
```bash
cd /home/rluft/fazai-ng

# Criar diretório web se não existir
mkdir -p web
cd web

# Inicializar Next.js
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir

# Dependências adicionais
npm install @qdrant/js-client-rest
npm install recharts  # Para gráficos
npm install lucide-react  # Ícones
npm install date-fns  # Date formatting
npm install zustand  # State management (opcional)
```

#### 1.2 Estrutura de Diretórios
```
web/
├── app/
│   ├── layout.tsx           # Root layout
│   ├── page.tsx             # Dashboard home
│   ├── personality/
│   │   ├── page.tsx         # Personality traits manager
│   │   └── [id]/page.tsx    # Edit trait
│   ├── learning/
│   │   └── page.tsx         # Learning outcomes
│   ├── cache/
│   │   └── page.tsx         # Cache stats
│   ├── qdrant/
│   │   └── page.tsx         # Collections manager
│   └── api/
│       ├── personality/route.ts
│       ├── learning/route.ts
│       ├── cache/route.ts
│       └── qdrant/route.ts
├── components/
│   ├── Sidebar.tsx
│   ├── PersonalityCard.tsx
│   ├── LearningTable.tsx
│   ├── CacheChart.tsx
│   └── QdrantCollectionCard.tsx
├── lib/
│   ├── qdrant.ts            # Qdrant client
│   └── types.ts             # TypeScript types
└── public/
    └── fazai-logo.svg
```

#### 1.3 Layout Base
**Arquivo:** `web/app/layout.tsx`

```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Sidebar from '@/components/Sidebar'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'FazAI Dashboard',
  description: 'Terminal Jarvis + AutoGPT Management',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <div className="flex h-screen bg-gray-50">
          <Sidebar />
          <main className="flex-1 overflow-y-auto p-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
```

#### 1.4 Sidebar Navigation
**Arquivo:** `web/components/Sidebar.tsx`

```typescript
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Brain, BookOpen, Zap, Database, Home } from 'lucide-react'

const navItems = [
  { href: '/', label: 'Dashboard', icon: Home },
  { href: '/personality', label: 'Personality', icon: Brain },
  { href: '/learning', label: 'Learning', icon: BookOpen },
  { href: '/cache', label: 'Cache', icon: Zap },
  { href: '/qdrant', label: 'Qdrant', icon: Database },
]

export default function Sidebar() {
  const pathname = usePathname()
  
  return (
    <aside className="w-64 bg-gray-900 text-white">
      <div className="p-6">
        <h1 className="text-2xl font-bold">FazAI</h1>
        <p className="text-sm text-gray-400">Terminal Jarvis</p>
      </div>
      
      <nav className="px-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-lg
                transition-colors duration-200
                ${isActive 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-300 hover:bg-gray-800'
                }
              `}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
```

#### 1.5 Dashboard Home
**Arquivo:** `web/app/page.tsx`

```typescript
import { Brain, BookOpen, Zap, Database } from 'lucide-react'

async function getStats() {
  // Em produção, chamar APIs
  return {
    traits: 12,
    learnings: 145,
    cacheHitRate: 0.73,
    qdrantCollections: 5
  }
}

export default async function Dashboard() {
  const stats = await getStats()
  
  const cards = [
    {
      title: 'Personality Traits',
      value: stats.traits,
      icon: Brain,
      color: 'bg-blue-500',
      href: '/personality'
    },
    {
      title: 'Learning Outcomes',
      value: stats.learnings,
      icon: BookOpen,
      color: 'bg-green-500',
      href: '/learning'
    },
    {
      title: 'Cache Hit Rate',
      value: `${(stats.cacheHitRate * 100).toFixed(1)}%`,
      icon: Zap,
      color: 'bg-yellow-500',
      href: '/cache'
    },
    {
      title: 'Qdrant Collections',
      value: stats.qdrantCollections,
      icon: Database,
      color: 'bg-purple-500',
      href: '/qdrant'
    }
  ]
  
  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <a
              key={card.title}
              href={card.href}
              className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`${card.color} p-3 rounded-lg`}>
                  <Icon className="text-white" size={24} />
                </div>
              </div>
              <p className="text-gray-600 text-sm">{card.title}</p>
              <p className="text-3xl font-bold mt-2">{card.value}</p>
            </a>
          )
        })}
      </div>
    </div>
  )
}
```

---

### FASE 2: Personality Manager (2 dias)

#### 2.1 API Route: Personality
**Arquivo:** `web/app/api/personality/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { QdrantClient } from '@qdrant/js-client-rest'

const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL || 'http://localhost:6333',
  apiKey: process.env.QDRANT_API_KEY
})

// GET /api/personality - List all traits
export async function GET() {
  try {
    const result = await qdrant.scroll('fazai_personality', {
      limit: 100,
      with_payload: true,
      with_vector: false
    })
    
    const traits = result.points.map(p => ({
      id: p.id,
      ...p.payload
    }))
    
    // Sort by intensity (descending)
    traits.sort((a: any, b: any) => (b.intensity || 0) - (a.intensity || 0))
    
    return NextResponse.json({ traits })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch traits' }, { status: 500 })
  }
}

// POST /api/personality - Create new trait
export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    const point = {
      id: Date.now(),
      vector: Array(1536).fill(0), // TODO: Generate real embedding
      payload: {
        trait_name: body.trait_name,
        category: body.category,
        value: body.value,
        intensity: body.intensity || 0.5,
        context: body.context,
        tags: body.tags || []
      }
    }
    
    await qdrant.upsert('fazai_personality', {
      points: [point]
    })
    
    return NextResponse.json({ success: true, id: point.id })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create trait' }, { status: 500 })
  }
}

// PUT /api/personality - Update trait
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    
    const point = {
      id: body.id,
      vector: Array(1536).fill(0),
      payload: {
        trait_name: body.trait_name,
        category: body.category,
        value: body.value,
        intensity: body.intensity,
        context: body.context,
        tags: body.tags || []
      }
    }
    
    await qdrant.upsert('fazai_personality', {
      points: [point]
    })
    
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update trait' }, { status: 500 })
  }
}

// DELETE /api/personality?id=123 - Delete trait
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 })
    }
    
    await qdrant.delete('fazai_personality', {
      points: [parseInt(id)]
    })
    
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete trait' }, { status: 500 })
  }
}
```

#### 2.2 Personality Manager Page
**Arquivo:** `web/app/personality/page.tsx`

```typescript
'use client'

import { useEffect, useState } from 'react'
import { Plus, Edit, Trash2 } from 'lucide-react'

interface PersonalityTrait {
  id: number
  trait_name: string
  category: string
  value: string
  intensity: number
  context?: string
  tags?: string[]
}

export default function PersonalityPage() {
  const [traits, setTraits] = useState<PersonalityTrait[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingTrait, setEditingTrait] = useState<PersonalityTrait | null>(null)
  
  useEffect(() => {
    fetchTraits()
  }, [])
  
  async function fetchTraits() {
    try {
      const res = await fetch('/api/personality')
      const data = await res.json()
      setTraits(data.traits)
    } catch (error) {
      console.error('Failed to fetch traits:', error)
    } finally {
      setLoading(false)
    }
  }
  
  async function deleteTrait(id: number) {
    if (!confirm('Delete this trait?')) return
    
    try {
      await fetch(`/api/personality?id=${id}`, { method: 'DELETE' })
      fetchTraits()
    } catch (error) {
      console.error('Failed to delete:', error)
    }
  }
  
  if (loading) {
    return <div>Loading...</div>
  }
  
  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Personality Traits</h1>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
        >
          <Plus size={20} />
          Add Trait
        </button>
      </div>
      
      <div className="grid gap-4">
        {traits.map((trait) => (
          <div
            key={trait.id}
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-xl font-semibold">{trait.trait_name}</h3>
                  <span className="bg-gray-200 text-gray-700 px-2 py-1 rounded text-sm">
                    {trait.category}
                  </span>
                </div>
                <p className="text-gray-600 mb-3">{trait.value}</p>
                
                {/* Intensity slider (read-only visual) */}
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">Intensity:</span>
                  <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-xs">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${trait.intensity * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium">{(trait.intensity * 100).toFixed(0)}%</span>
                </div>
                
                {trait.tags && trait.tags.length > 0 && (
                  <div className="flex gap-2 mt-3">
                    {trait.tags.map((tag, i) => (
                      <span key={i} className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingTrait(trait)}
                  className="p-2 hover:bg-gray-100 rounded"
                >
                  <Edit size={18} />
                </button>
                <button
                  onClick={() => deleteTrait(trait.id)}
                  className="p-2 hover:bg-red-100 text-red-600 rounded"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* TODO: Add trait form modal */}
      {showForm && (
        <div>Form modal here...</div>
      )}
    </div>
  )
}
```

#### 2.3 Trait Form Component
**Arquivo:** `web/components/PersonalityForm.tsx`

```typescript
'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

interface PersonalityTrait {
  id?: number
  trait_name: string
  category: string
  value: string
  intensity: number
  context?: string
  tags?: string[]
}

interface Props {
  trait?: PersonalityTrait
  onClose: () => void
  onSave: () => void
}

export default function PersonalityForm({ trait, onClose, onSave }: Props) {
  const [formData, setFormData] = useState<PersonalityTrait>(trait || {
    trait_name: '',
    category: '',
    value: '',
    intensity: 0.5,
    context: '',
    tags: []
  })
  
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    try {
      const method = trait?.id ? 'PUT' : 'POST'
      await fetch('/api/personality', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      
      onSave()
      onClose()
    } catch (error) {
      console.error('Failed to save:', error)
    }
  }
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">
            {trait ? 'Edit Trait' : 'New Trait'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Trait Name</label>
            <input
              type="text"
              value={formData.trait_name}
              onChange={(e) => setFormData({ ...formData, trait_name: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
              required
            >
              <option value="">Select...</option>
              <option value="communication">Communication</option>
              <option value="decision_making">Decision Making</option>
              <option value="ethics">Ethics</option>
              <option value="technical">Technical</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={formData.value}
              onChange={(e) => setFormData({ ...formData, value: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
              rows={3}
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">
              Intensity: {(formData.intensity * 100).toFixed(0)}%
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={formData.intensity}
              onChange={(e) => setFormData({ ...formData, intensity: parseFloat(e.target.value) })}
              className="w-full"
            />
          </div>
          
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

---

## 📝 Checklist de Tarefas

### Fase 1: Setup + Dashboard
- [ ] Criar projeto Next.js em `web/`
- [ ] Configurar Tailwind CSS
- [ ] Criar layout base com Sidebar
- [ ] Implementar dashboard home com cards de estatísticas
- [ ] Testar navegação entre páginas
- [ ] Commitar: `feat(web): Add Next.js dashboard with base layout`

### Fase 2: Personality Manager
- [ ] Criar API route `/api/personality`
- [ ] Implementar GET/POST/PUT/DELETE
- [ ] Criar página `app/personality/page.tsx`
- [ ] Implementar PersonalityForm component
- [ ] Testar CRUD completo de traits
- [ ] Commitar: `feat(web): Add personality traits manager with CRUD`

---

## 🧪 Como Testar

### Teste 1: Dashboard Carrega
```bash
cd web
npm run dev
# Abrir http://localhost:3000
```

### Teste 2: Personality CRUD
1. Navegar para /personality
2. Clicar "Add Trait"
3. Preencher formulário
4. Salvar
5. Verificar trait aparece na lista
6. Editar trait
7. Deletar trait

### Teste 3: Qdrant Connection
```bash
# Verificar se Qdrant está rodando
curl http://localhost:6333

# Ver collections
curl http://localhost:6333/collections
```

---

## 📚 Recursos

- **Next.js 14 Docs:** https://nextjs.org/docs
- **Tailwind CSS:** https://tailwindcss.com/docs
- **Qdrant API:** https://qdrant.tech/documentation/interfaces/
- **Recharts:** https://recharts.org/
- **Lucide Icons:** https://lucide.dev/

---

## ⚠️ Notas Importantes

1. **Responsividade:** Interface deve funcionar em desktop e tablet
2. **Performance:** Use React Server Components onde possível
3. **UX:** Loading states, error handling, confirmations
4. **TypeScript:** Tipagem forte em todo o código
5. **API:** Todas as rotas devem validar inputs

---

## 🚀 Git Workflow

```bash
# Criar branch
git checkout -b feat/web-dashboard

# Desenvolvimento
npm run dev  # Watch mode

# Build teste
npm run build

# Commit (mensagens semânticas)
git add .
git commit -m "feat(web): Add Next.js base setup"
git commit -m "feat(web): Add personality manager CRUD"

# Push
git push origin feat/web-dashboard
```

---

**Prioridade Máxima:** Fase 1 (Setup + Dashboard)  
**Tempo Estimado:** 2 dias  
**Após Completar:** Implementar Learning e Cache pages

**BOA SORTE! 🚀**
