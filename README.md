# 🏗️ Autonomous Structural Intelligence System

---

## 📌 Project Title

Autonomous Structural Intelligence System
*Floor Plan Parser · 3D Generator · Material Optimiser*

---

## 📖 Project Description

This project is an AI-powered system that takes a digital floor plan as input and transforms it into a complete structural understanding of a building. The system parses the floor plan using computer vision techniques, reconstructs the geometry into a structured representation, and generates a 3D model of the building.

Beyond visualization, the system analyzes each structural element and recommends optimal construction materials based on cost, strength, and durability trade-offs. It also provides clear, human-readable explanations for every decision, making the output understandable even to non-experts.

The entire pipeline is fully automated and designed to work end-to-end, from raw image input to final structural insights.

---

## 🎯 Project Vision

The goal of this project is to bridge the gap between architectural design and structural decision-making using AI.

Instead of requiring manual interpretation of floor plans by engineers, this system aims to:

* Automate structural analysis
* Assist in material selection
* Improve decision transparency through explainable AI

In the long term, this can evolve into a tool that supports architects, civil engineers, and construction planners in making faster, data-driven decisions with higher accuracy and lower cost.

---

## 🚀 Key Features

### 🧠 Intelligent Floor Plan Parsing

* Detects walls, rooms, and openings using OpenCV
* Extracts spatial coordinates and structural layout

### 🏗️ Geometry Reconstruction

* Converts detected elements into a graph structure
* Identifies load-bearing vs partition walls
* Ensures structural consistency

### 🧱 3D Model Generation

* Converts 2D plans into a 3D model using Three.js
* Interactive visualization (zoom, rotate, inspect)

### 📊 Material Analysis Engine

* Recommends materials based on cost-strength trade-offs
* Uses weighted scoring depending on wall type
* Provides ranked suggestions per structural element

### 💡 Explainability Engine

* Generates human-readable reasoning for decisions
* References span length, wall type, and structural role
* Highlights potential structural issues

### 🔄 End-to-End Pipeline

* Fully integrated system from input to output
* Modular architecture for scalability and testing

---

## ⛓️ Deployed Smart Contract Details

*(Web3 Bonus Integration — Optional)*

### ➤ Contract ID

`YOUR_SMART_CONTRACT_ID_HERE`

> The smart contract is deployed on the Stellar network and is used to store and verify structural analysis outputs (e.g., material recommendations and metadata).
> It ensures transparency, immutability, and traceability of the system’s decisions.

---

## 📸 UI Screenshots

*(Add screenshots here of: Upload page, 3D viewer, material panel, explanation panel)*

---

## 🌐 Demo Link (Optional)

`https://your-live-app-link.com`

---

## 🎥 Demo Video (Optional)

`https://your-demo-video-link.com`

---

## ⚙️ Project Setup Guide

### 1. Clone Repository

```bash
git clone https://github.com/your-username/your-repo.git
cd your-repo
```

### 2. Backend Setup

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### 4. Open Application

```
http://localhost:5173
```

---

## 🔮 Future Scope

* Support for multi-storey building analysis
* Real-time material pricing integration
* Improved handling of noisy/hand-drawn plans
* Structural safety validation (load distribution, stress points)
* Automated cost estimation reports (PDF export)
* AI-based layout optimization suggestions

---

## 🧠 Final Note

The core challenge of this project is not just detecting walls or rendering 3D models, but building a system that can *reason* about structures and explain its decisions clearly.

This project focuses on combining computer vision, geometry, and AI reasoning into a single cohesive pipeline that delivers meaningful, actionable insights.

---
