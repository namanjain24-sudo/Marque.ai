import { Route, Routes } from "react-router-dom"

import { AppLayout } from "./components/AppLayout"
import { Footer } from "./components/Footer"
import { Nav } from "./components/Nav"
import { BrandProvider } from "./context/BrandContext"

// Marketing pages (existing nav + footer)
import { Home } from "./pages/Home"
import { Onboard } from "./pages/Onboard"
import { Brands } from "./pages/Brands"
import { BrandDashboard } from "./pages/BrandDashboard"

// App pages (inside AppLayout)
import { Brand } from "./pages/Brand"
import { Workspace } from "./pages/Workspace"
import { Campaigns } from "./pages/Campaigns"
import { CampaignDetail } from "./pages/CampaignDetail"
import { Editor } from "./pages/Editor"
import { Library } from "./pages/Library"
import { Audit } from "./pages/Audit"

function MarketingLayout({ children, landing = false }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Nav landing={landing} />
      <main className="flex-1">{children}</main>
      <Footer landing={landing} />
    </div>
  )
}

function App() {
  return (
    <BrandProvider>
      <Routes>
        {/* Marketing / public routes */}
        <Route path="/" element={<MarketingLayout landing><Home /></MarketingLayout>} />
        <Route path="/onboard" element={<MarketingLayout><Onboard /></MarketingLayout>} />
        <Route path="/brands" element={<MarketingLayout><Brands /></MarketingLayout>} />
        <Route path="/brand/:id" element={<MarketingLayout><BrandDashboard /></MarketingLayout>} />

        {/* App routes — shared AppLayout with left sidebar */}
        <Route element={<AppLayout />}>
          <Route path="/brand" element={<Brand />} />
          <Route path="/workspace" element={<Workspace />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/campaigns/:id" element={<CampaignDetail />} />
          <Route path="/editor/:assetId" element={<Editor />} />
          <Route path="/library" element={<Library />} />
          <Route path="/audit" element={<Audit />} />
        </Route>
      </Routes>
    </BrandProvider>
  )
}

export default App
