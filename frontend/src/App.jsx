import { Route, Routes } from "react-router-dom"

import { Footer } from "./components/Footer"
import { Nav } from "./components/Nav"
import { BrandDashboard } from "./pages/BrandDashboard"
import { Brands } from "./pages/Brands"
import { Home } from "./pages/Home"
import { Onboard } from "./pages/Onboard"

function App() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Nav />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/onboard" element={<Onboard />} />
          <Route path="/brands" element={<Brands />} />
          <Route path="/brand/:id" element={<BrandDashboard />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}

export default App
