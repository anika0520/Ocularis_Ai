# 👁️ Ocularis AI

> Real-time Eye Health & Fatigue Monitoring Dashboard built with React + Vite.

Ocularis AI is a modern web-based analytics dashboard that tracks and visualizes eye activity metrics such as blink rate, fatigue score, ambient lighting, and screen distance.  
It is designed to promote healthier screen usage habits through real-time feedback and intelligent scoring.

---

## 🚀 Live Demo

Link- https://ocularis-silk.vercel.app/

---

## ✨ Key Features

- 📊 Real-time eye activity dashboard
- 👁️ Blink rate monitoring utilities
- 🧠 Intelligent fatigue scoring algorithm
- 💡 Ambient light condition analysis
- 📏 Screen distance estimation logic
- 📈 Interactive visualizations with Recharts
- 🎨 Clean, modern UI powered by Tailwind CSS
- ⚡ Lightning-fast dev environment via Vite

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|----------|
| React 18 | UI Framework |
| Vite 5 | Build Tool |
| Tailwind CSS 4 | Styling |
| Recharts | Data Visualization |
| Framer Motion | Animations |
| Lucide React | Icon System |

---

## 📂 Project Structure

```bash
ocularis-ai/
│
├── src/
│   ├── components/
│   │   ├── MetricCard.jsx
│   │   └── StatBox.jsx
│   │
│   ├── services/
│   │   └── geminiService.js
│   │
│   ├── utils/
│   │   ├── blinkUtils.js
│   │   ├── distanceUtils.js
│   │   ├── fatigueScore.js
│   │   └── lightUtils.js
│   │
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
│
├── index.html
├── package.json
├── tailwind.config.js
├── vite.config.js
└── .env
```

---

## ⚙️ Getting Started

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/your-username/ocularis-ai.git
cd ocularis-ai
```

### 2️⃣ Install Dependencies

```bash
npm install
```

### 3️⃣ Start Development Server

```bash
npm run dev
```

App will be available at:

```
http://localhost:5173
```

### 4️⃣ Build for Production

```bash
npm run build
```

### 5️⃣ Preview Production Build

```bash
npm run preview
```

---

## 🔐 Environment Variables

Create a `.env` file in the root directory:

```env
VITE_GEMINI_API_KEY=your_api_key_here
```

> ⚠️ Never commit your `.env` file.

---

## 🧠 Core Logic Overview

### Blink Detection
Utility functions calculate blink frequency trends over time.

### Fatigue Score
Custom scoring algorithm combining:
- Blink rate patterns
- Time spent on screen
- Behavioral thresholds

### Distance Monitoring
Estimates approximate face-to-screen distance for posture awareness.

### Light Analysis
Evaluates ambient lighting conditions to reduce eye strain risk.

---

## 📈 Why This Project?

Ocularis AI demonstrates:

- Real-time state management
- Modular utility-driven architecture
- Data visualization integration
- Clean component structure
- Scalable frontend architecture
- Environment-based API configuration

This project is ideal for:
- Health-tech demos
- AI-integrated dashboards
- Human-computer interaction research
- Portfolio showcase

---

## 🔮 Future Improvements

- 🎥 Live webcam-based tracking
- 🗂 Historical data persistence (LocalStorage / DB)
- 🔔 Smart alerts & recommendations
- 👤 User authentication
- 📱 Mobile responsiveness optimization
- ☁️ Backend integration for analytics storage

---

## 🧪 Development Notes

- Component-based architecture
- Utility-driven business logic separation
- Easily extendable metric system
- Designed for performance and clarity

---

## 📄 License

Licensed under the MIT License.

---

## ⭐ Support

If you found this project useful, consider giving it a star ⭐ on GitHub!
