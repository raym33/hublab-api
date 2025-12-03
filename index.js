import express from 'express'
import cors from 'cors'

const app = express()
const PORT = process.env.PORT || 3001
const GROQ_API_KEY = process.env.GROQ_API_KEY

app.use(cors())
app.use(express.json({ limit: '10mb' }))

// ============================================
// SCHEMA
// ============================================

const schema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'HubLab Project Schema',
  description: 'Schema for AI-generated multi-platform app projects',
  version: '1.0.0',
  definitions: {
    PropType: {
      enum: ['string', 'number', 'boolean', 'color', 'size', 'spacing', 'icon', 'image', 'action', 'array', 'object', 'select', 'slot']
    },
    Platform: {
      enum: ['web', 'ios', 'android', 'desktop']
    },
    CapsuleInstance: {
      type: 'object',
      required: ['id', 'capsuleId', 'props'],
      properties: {
        id: { type: 'string', pattern: '^[a-z][a-z0-9-]*$' },
        capsuleId: {
          type: 'string',
          enum: [
            'button', 'text', 'input', 'card', 'image', 'list', 'modal', 'form',
            'navigation', 'auth-screen', 'chart', 'skeleton', 'switch', 'slider',
            'tabs', 'accordion', 'dropdown', 'datepicker', 'progress', 'tooltip',
            'table', 'searchbar', 'rating', 'stepper', 'chip', 'divider',
            'calendar', 'file-upload', 'carousel', 'timeline', 'bottom-sheet',
            'popover', 'color-picker', 'rich-text-editor', 'signature', 'map',
            'video', 'audio', 'data-table', 'kanban', 'chat', 'qrcode', 'scanner',
            'pdf-viewer', 'notifications', 'webview', 'biometrics', 'location',
            'camera', 'social-share'
          ]
        },
        props: { type: 'object', additionalProperties: true },
        children: { type: 'array', items: { $ref: '#/definitions/CapsuleInstance' } }
      }
    }
  },
  type: 'object',
  required: ['name', 'version', 'targets', 'screens', 'theme'],
  properties: {
    name: { type: 'string', pattern: '^[A-Za-z][A-Za-z0-9 -]*$' },
    version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' },
    targets: { type: 'array', items: { $ref: '#/definitions/Platform' } },
    screens: { type: 'array', items: { type: 'object' } },
    theme: { type: 'object' }
  },
  examples: [
    {
      name: 'Todo App',
      version: '1.0.0',
      targets: ['ios', 'android'],
      theme: { name: 'Default', colors: { primary: '#6366F1', secondary: '#8B5CF6', background: '#FFFFFF' } },
      screens: [{ id: 'home', name: 'Home', root: { id: 'card', capsuleId: 'card', props: { title: 'Tasks' }, children: [] } }]
    }
  ]
}

// ============================================
// CODE GENERATORS
// ============================================

function generateSwiftUI(project) {
  const files = []
  const appName = project.name.replace(/\s+/g, '')

  // App entry point
  files.push({
    path: `${appName}App.swift`,
    language: 'swift',
    content: `import SwiftUI

@main
struct ${appName}App: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}`
  })

  // ContentView with navigation
  const navType = project.navigation?.type || 'stack'
  let contentBody = ''

  if (navType === 'tabs' && project.screens.length > 1) {
    const tabs = project.screens.map(s => {
      const viewName = capitalize(s.id) + 'View'
      return `            ${viewName}()
                .tabItem {
                    Label("${s.name}", systemImage: "star")
                }`
    }).join('\n')
    contentBody = `TabView {\n${tabs}\n        }`
  } else {
    const initialView = capitalize(project.screens[0]?.id || 'Home') + 'View'
    contentBody = `NavigationStack {\n            ${initialView}()\n        }`
  }

  files.push({
    path: 'ContentView.swift',
    language: 'swift',
    content: `import SwiftUI

struct ContentView: View {
    var body: some View {
        ${contentBody}
    }
}

#Preview {
    ContentView()
}`
  })

  // Generate each screen
  for (const screen of project.screens) {
    const viewName = capitalize(screen.id) + 'View'
    const content = generateSwiftUIComponent(screen.root, project.theme)

    files.push({
      path: `${viewName}.swift`,
      language: 'swift',
      content: `import SwiftUI

struct ${viewName}: View {
    var body: some View {
        ${content}
            .navigationTitle("${screen.name}")
    }
}

#Preview {
    NavigationStack {
        ${viewName}()
    }
}`
    })
  }

  return files
}

function generateSwiftUIComponent(instance, theme) {
  if (!instance) return 'EmptyView()'

  const { capsuleId, props, children } = instance
  const childContent = children?.map(c => generateSwiftUIComponent(c, theme)).join('\n                ') || ''

  switch (capsuleId) {
    case 'button':
      return `Button(action: { /* ${props.onPress || 'action'} */ }) {
            Text("${props.text || 'Button'}")
        }
        .buttonStyle(.borderedProminent)`

    case 'text':
      return `Text("${props.content || props.text || ''}")`

    case 'input':
      return `TextField("${props.placeholder || ''}", text: .constant(""))
            .textFieldStyle(.roundedBorder)`

    case 'card':
      return `VStack(alignment: .leading, spacing: 16) {
            ${props.title ? `Text("${props.title}").font(.headline)` : ''}
            ${childContent}
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(radius: 4)`

    case 'list':
      return `List {
            ForEach(0..<5, id: \\.self) { index in
                Text("Item \\(index + 1)")
            }
        }
        .listStyle(.plain)`

    case 'progress':
      const value = (props.value || 50) / 100
      return `ProgressView(value: ${value})
            .progressViewStyle(.linear)`

    case 'switch':
      return `Toggle("${props.label || ''}", isOn: .constant(${props.checked || false}))`

    case 'chart':
      return `// Chart - requires iOS 16+ and Charts framework
        Chart {
            // Add chart data
        }
        .frame(height: 200)`

    case 'searchbar':
      return `TextField("${props.placeholder || 'Search...'}", text: .constant(""))
            .textFieldStyle(.roundedBorder)
            .overlay(
                HStack {
                    Image(systemName: "magnifyingglass")
                        .foregroundColor(.gray)
                        .padding(.leading, 8)
                    Spacer()
                }
            )`

    case 'slider':
      return `Slider(value: .constant(${(props.value || 50) / 100}), in: ${props.min || 0}...${props.max || 100})`

    case 'divider':
      return `Divider()`

    default:
      if (children && children.length > 0) {
        return `VStack(spacing: 16) {
            ${childContent}
        }`
      }
      return `// TODO: ${capsuleId}
        Text("${capsuleId}")`
  }
}

function generateJetpackCompose(project) {
  const files = []
  const packageName = project.platformConfig?.android?.packageName || 'com.hublab.app'
  const appName = project.name.replace(/\s+/g, '')

  // MainActivity
  files.push({
    path: 'MainActivity.kt',
    language: 'kotlin',
    content: `package ${packageName}

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.*
import androidx.compose.runtime.*
import ${packageName}.ui.theme.${appName}Theme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            ${appName}Theme {
                Surface(color = MaterialTheme.colorScheme.background) {
                    ${capitalize(project.screens[0]?.id || 'Main')}Screen()
                }
            }
        }
    }
}`
  })

  // Generate screens
  for (const screen of project.screens) {
    const screenName = capitalize(screen.id) + 'Screen'
    const content = generateComposeComponent(screen.root, project.theme)

    files.push({
      path: `${screenName}.kt`,
      language: 'kotlin',
      content: `package ${packageName}.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun ${screenName}() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        ${content}
    }
}`
    })
  }

  return files
}

function generateComposeComponent(instance, theme) {
  if (!instance) return 'Text("Empty")'

  const { capsuleId, props, children } = instance
  const childContent = children?.map(c => generateComposeComponent(c, theme)).join('\n        Spacer(Modifier.height(8.dp))\n        ') || ''

  switch (capsuleId) {
    case 'button':
      return `Button(onClick = { /* ${props.onPress || 'action'} */ }) {
            Text("${props.text || 'Button'}")
        }`

    case 'text':
      return `Text("${props.content || props.text || ''}")`

    case 'input':
      return `var text by remember { mutableStateOf("") }
        OutlinedTextField(
            value = text,
            onValueChange = { text = it },
            label = { Text("${props.label || ''}") },
            placeholder = { Text("${props.placeholder || ''}") },
            modifier = Modifier.fillMaxWidth()
        )`

    case 'card':
      return `Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp)) {
                ${props.title ? `Text("${props.title}", style = MaterialTheme.typography.titleMedium)` : ''}
                ${childContent}
            }
        }`

    case 'list':
      return `LazyColumn {
            items(5) { index ->
                ListItem(headlineContent = { Text("Item \${index + 1}") })
            }
        }`

    case 'progress':
      const value = (props.value || 50) / 100
      return `LinearProgressIndicator(
            progress = { ${value}f },
            modifier = Modifier.fillMaxWidth()
        )`

    case 'switch':
      return `var checked by remember { mutableStateOf(${props.checked || false}) }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("${props.label || ''}")
            Spacer(Modifier.weight(1f))
            Switch(checked = checked, onCheckedChange = { checked = it })
        }`

    case 'slider':
      return `var value by remember { mutableFloatStateOf(${(props.value || 50) / 100}f) }
        Slider(
            value = value,
            onValueChange = { value = it },
            valueRange = ${props.min || 0}f..${props.max || 100}f
        )`

    case 'divider':
      return `HorizontalDivider()`

    case 'searchbar':
      return `var query by remember { mutableStateOf("") }
        OutlinedTextField(
            value = query,
            onValueChange = { query = it },
            placeholder = { Text("${props.placeholder || 'Search...'}") },
            leadingIcon = { Icon(Icons.Default.Search, "Search") },
            modifier = Modifier.fillMaxWidth()
        )`

    default:
      if (children && children.length > 0) {
        return `Column {
            ${childContent}
        }`
      }
      return `// TODO: ${capsuleId}
        Text("${capsuleId}")`
  }
}

function generateReact(project) {
  const files = []
  const appName = project.name.replace(/\s+/g, '')

  // App.tsx
  const imports = project.screens.map(s =>
    `import ${capitalize(s.id)}Page from './pages/${s.id}'`
  ).join('\n')

  files.push({
    path: 'App.tsx',
    language: 'typescript',
    content: `import React from 'react'
${imports}

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <${capitalize(project.screens[0]?.id || 'Home')}Page />
    </div>
  )
}`
  })

  // Generate pages
  for (const screen of project.screens) {
    const pageName = capitalize(screen.id) + 'Page'
    const content = generateReactComponent(screen.root, project.theme)

    files.push({
      path: `pages/${screen.id}.tsx`,
      language: 'typescript',
      content: `import React from 'react'

export default function ${pageName}() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">${screen.name}</h1>
      ${content}
    </div>
  )
}`
    })
  }

  // Tailwind config
  files.push({
    path: 'tailwind.config.js',
    language: 'javascript',
    content: `module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '${project.theme?.colors?.primary || '#6366F1'}',
        secondary: '${project.theme?.colors?.secondary || '#8B5CF6'}',
      }
    }
  },
  plugins: []
}`
  })

  return files
}

function generateReactComponent(instance, theme) {
  if (!instance) return '<div />'

  const { capsuleId, props, children } = instance
  const childContent = children?.map(c => generateReactComponent(c, theme)).join('\n        ') || ''
  const primary = theme?.colors?.primary || '#6366F1'

  switch (capsuleId) {
    case 'button':
      return `<button
        onClick={() => { /* ${props.onPress || 'action'} */ }}
        className="px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90"
      >
        ${props.text || 'Button'}
      </button>`

    case 'text':
      return `<p>${props.content || props.text || ''}</p>`

    case 'input':
      return `<input
        type="${props.type || 'text'}"
        placeholder="${props.placeholder || ''}"
        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
      />`

    case 'card':
      return `<div className="bg-white rounded-xl shadow-md p-4">
        ${props.title ? `<h3 className="text-lg font-semibold mb-2">${props.title}</h3>` : ''}
        ${childContent}
      </div>`

    case 'list':
      return `<ul className="divide-y">
        {[1, 2, 3, 4, 5].map(i => (
          <li key={i} className="py-3">Item {i}</li>
        ))}
      </ul>`

    case 'progress':
      return `<div className="w-full bg-gray-200 rounded-full h-2">
        <div className="bg-primary h-2 rounded-full" style={{ width: '${props.value || 50}%' }} />
      </div>`

    case 'switch':
      return `<label className="flex items-center gap-2">
        <input type="checkbox" className="toggle" ${props.checked ? 'defaultChecked' : ''} />
        <span>${props.label || ''}</span>
      </label>`

    default:
      if (children && children.length > 0) {
        return `<div className="space-y-4">
        ${childContent}
      </div>`
      }
      return `<div>{/* TODO: ${capsuleId} */}</div>`
  }
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function countCapsules(instance) {
  if (!instance) return 0
  let count = 1
  if (instance.children) {
    for (const child of instance.children) {
      count += countCapsules(child)
    }
  }
  return count
}

// ============================================
// ROUTES
// ============================================

app.get('/', (req, res) => {
  res.json({
    name: 'HubLab API',
    version: '1.0.0',
    endpoints: {
      'GET /schema': 'JSON Schema for projects',
      'POST /generate': 'Generate native code from project JSON',
      'GET /health': 'Health check'
    },
    docs: 'https://hublab.dev/docs'
  })
})

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.get('/schema', (req, res) => {
  res.json(schema)
})

app.post('/generate', (req, res) => {
  try {
    const project = req.body

    if (!project.name || !project.targets || !project.screens || !project.theme) {
      return res.status(400).json({
        error: 'Missing required fields: name, targets, screens, theme'
      })
    }

    const results = []
    let totalCapsules = 0

    for (const screen of project.screens) {
      totalCapsules += countCapsules(screen.root)
    }

    for (const target of project.targets) {
      let files = []

      switch (target) {
        case 'ios':
          files = generateSwiftUI(project)
          break
        case 'android':
          files = generateJetpackCompose(project)
          break
        case 'web':
        case 'desktop':
          files = generateReact(project)
          break
      }

      results.push({
        success: true,
        platform: target,
        files,
        metadata: {
          capsuleCount: totalCapsules,
          screenCount: project.screens.length,
          generatedAt: new Date().toISOString()
        }
      })
    }

    res.json({
      success: true,
      project: {
        name: project.name,
        version: project.version
      },
      results,
      summary: {
        totalPlatforms: results.length,
        totalFiles: results.reduce((sum, r) => sum + r.files.length, 0),
        totalCapsules,
        totalScreens: project.screens.length
      }
    })

  } catch (error) {
    console.error('Generation error:', error)
    res.status(400).json({
      error: 'Invalid project specification',
      details: error.message
    })
  }
})

// ============================================
// AI GENERATION WITH GROQ
// ============================================

const SYSTEM_PROMPT = `You are HubLab AI, an assistant that generates mobile app specifications in JSON format.

AVAILABLE CAPSULES (use these in capsuleId):
- button: Text button with variants (primary, secondary, outline, ghost)
- text: Display text with variants (heading, subheading, body, caption)
- input: Text input with placeholder, label, type (text, email, password, number)
- card: Container with title, elevation, children
- image: Display image with src, alt, aspectRatio
- list: Scrollable list with items, separator
- modal: Popup dialog with title, content
- form: Form container with onSubmit
- chart: Data visualization (line, bar, pie)
- progress: Progress indicator (linear, circular) with value 0-100
- switch: Toggle switch with label, checked
- slider: Range slider with min, max, value
- tabs: Tab navigation with items
- accordion: Collapsible sections
- dropdown: Select dropdown with options
- datepicker: Date selection
- calendar: Full calendar view
- searchbar: Search input with placeholder
- rating: Star rating with max, value
- chip: Tag/chip with label, removable
- divider: Visual separator
- avatar: User avatar with src, name, size
- badge: Status badge with label, variant
- tooltip: Hover tooltip
- table: Data table with columns, rows
- carousel: Image/content carousel
- timeline: Vertical timeline
- map: Interactive map
- video: Video player
- chat: Chat message bubbles
- qrcode: QR code generator
- notifications: Push notification UI
- scanner: QR/barcode scanner
- audio: Audio player with controls
- skeleton: Loading placeholder with shimmer
- stepper: Numeric input with +/- buttons
- signature: Signature capture pad
- confetti: Celebration animation effect

RESPONSE FORMAT:
Return ONLY valid JSON (no markdown, no explanation). Use this structure:
{
  "name": "App Name",
  "version": "1.0.0",
  "targets": ["ios", "android"],
  "theme": {
    "colors": {
      "primary": "#6366F1",
      "secondary": "#8B5CF6",
      "background": "#FFFFFF",
      "surface": "#F8FAFC",
      "text": { "primary": "#1E293B", "secondary": "#64748B" }
    }
  },
  "navigation": { "type": "tabs" or "stack", "initialScreen": "screenId" },
  "screens": [
    {
      "id": "screen-id",
      "name": "Screen Name",
      "root": {
        "id": "unique-id",
        "capsuleId": "card",
        "props": { ... },
        "children": [ ... ]
      }
    }
  ]
}

RULES:
1. Use lowercase-kebab-case for all IDs
2. Every capsule needs: id, capsuleId, props
3. Match the app description with appropriate capsules
4. Design realistic, complete apps with 2-4 screens
5. Use semantic component hierarchy (cards contain content, lists contain items)
6. Choose colors that match the app's theme/purpose
7. ONLY output JSON, nothing else`

const CAPSULE_LIST = schema.definitions.CapsuleInstance.properties.capsuleId.enum

app.post('/ai/generate', async (req, res) => {
  try {
    const { prompt } = req.body

    if (!prompt) {
      return res.status(400).json({ error: 'Missing prompt' })
    }

    if (!GROQ_API_KEY) {
      return res.status(500).json({ error: 'GROQ_API_KEY not configured' })
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Create a mobile app for: ${prompt}` }
        ],
        temperature: 0.7,
        max_tokens: 4000
      })
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Groq API error:', error)
      return res.status(500).json({ error: 'AI generation failed', details: error })
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
      return res.status(500).json({ error: 'No content from AI' })
    }

    // Parse the JSON from AI response
    let project
    try {
      // Clean up potential markdown formatting
      const jsonStr = content.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim()
      project = JSON.parse(jsonStr)
    } catch (parseError) {
      console.error('JSON parse error:', parseError, 'Content:', content)
      return res.status(500).json({
        error: 'Failed to parse AI response',
        raw: content
      })
    }

    // Validate basic structure
    if (!project.name || !project.screens) {
      return res.status(500).json({
        error: 'Invalid project structure from AI',
        project
      })
    }

    // Ensure required fields have defaults
    project.version = project.version || '1.0.0'
    project.targets = project.targets || ['ios', 'android']
    project.theme = project.theme || { colors: { primary: '#6366F1' } }

    res.json({
      success: true,
      project,
      message: `Generated "${project.name}" with ${project.screens.length} screens`
    })

  } catch (error) {
    console.error('AI generation error:', error)
    res.status(500).json({ error: 'AI generation failed', details: error.message })
  }
})

// Combined endpoint: AI generate + code generation
app.post('/ai/build', async (req, res) => {
  try {
    const { prompt, targets = ['ios', 'android'] } = req.body

    if (!prompt) {
      return res.status(400).json({ error: 'Missing prompt' })
    }

    if (!GROQ_API_KEY) {
      return res.status(500).json({ error: 'GROQ_API_KEY not configured' })
    }

    // Step 1: Generate project JSON with AI
    const aiResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Create a mobile app for: ${prompt}. Target platforms: ${targets.join(', ')}` }
        ],
        temperature: 0.7,
        max_tokens: 4000
      })
    })

    if (!aiResponse.ok) {
      const error = await aiResponse.text()
      return res.status(500).json({ error: 'AI generation failed', details: error })
    }

    const aiData = await aiResponse.json()
    const content = aiData.choices[0]?.message?.content

    let project
    try {
      const jsonStr = content.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim()
      project = JSON.parse(jsonStr)
    } catch (e) {
      return res.status(500).json({ error: 'Failed to parse AI response', raw: content })
    }

    // Ensure targets
    project.targets = targets
    project.version = project.version || '1.0.0'
    project.theme = project.theme || { colors: { primary: '#6366F1' } }

    // Step 2: Generate native code
    const results = []
    let totalCapsules = 0

    for (const screen of project.screens) {
      totalCapsules += countCapsules(screen.root)
    }

    for (const target of project.targets) {
      let files = []

      switch (target) {
        case 'ios':
          files = generateSwiftUI(project)
          break
        case 'android':
          files = generateJetpackCompose(project)
          break
        case 'web':
        case 'desktop':
          files = generateReact(project)
          break
      }

      results.push({
        success: true,
        platform: target,
        files,
        metadata: {
          capsuleCount: totalCapsules,
          screenCount: project.screens.length,
          generatedAt: new Date().toISOString()
        }
      })
    }

    res.json({
      success: true,
      prompt,
      project,
      results,
      summary: {
        totalPlatforms: results.length,
        totalFiles: results.reduce((sum, r) => sum + r.files.length, 0),
        totalCapsules,
        totalScreens: project.screens.length
      }
    })

  } catch (error) {
    console.error('AI build error:', error)
    res.status(500).json({ error: 'AI build failed', details: error.message })
  }
})

app.listen(PORT, () => {
  console.log(`🚀 HubLab API running on port ${PORT}`)
  console.log(`🤖 Groq AI: ${GROQ_API_KEY ? 'configured' : 'NOT configured'}`)
})
