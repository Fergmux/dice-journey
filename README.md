# 🎲 Dice Journey

A visual dice rolling application that lets you create custom dice scenarios with branching paths based on success or failure outcomes.

## Features

- **Visual Node Builder**: Create and arrange dice roll nodes on a canvas using drag-and-drop
- **Branching Logic**: Connect nodes to create conditional paths - trigger different rolls based on success or failure
- **Multiple Scenarios**: Create and switch between multiple dice journey scenarios
- **Custom Dice**: Configure dice with custom names, sides (d4, d6, d8, d10, d12, d20), counts, and success thresholds
- **Success/Failure Messages**: Add custom messages that display based on roll outcomes
- **Persistent Storage**: All scenarios are automatically saved to your browser's local storage
- **Interactive Roller**: Roll dice and watch the journey unfold as connected nodes trigger automatically

## Getting Started

### Prerequisites

- Node.js (v18+)
- npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

## How It Works

1. **Build** - Use the Builder page to create dice roll nodes. Each node can contain multiple dice with different configurations.

2. **Connect** - Link nodes together by clicking the colored circles:
   - 🟢 Green circle = trigger on success
   - 🔴 Red circle = trigger on failure
   - ⚪ White circle = connection target

3. **Roll** - Go to the Roller page, select your scenario, and hit "Roll All" to execute the journey. Successful rolls automatically trigger connected nodes.

## Tech Stack

- [Vue 3](https://vuejs.org/) with Composition API
- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [VueUse](https://vueuse.org/) for composables and local storage
- [PrimeVue](https://primevue.org/) for tooltips
- [PrimeIcons](https://primevue.org/icons/) for icons
