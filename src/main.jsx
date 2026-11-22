import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.jsx'
import BoardsPage from './pages/BoardsPage.jsx'
import BoardPage from './pages/BoardPage.jsx'
import Layout from "./components/Layout";

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<App />} />
          <Route path="/boards" element={<BoardsPage />} />
          <Route path="/boards/:boardId" element={<BoardPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>
)