import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LanguageProvider, GardenProvider } from './context/AppContext';
import AppLayout from './components/layout/AppLayout';
import HomePage from './pages/HomePage';
import GardenPage from './pages/GardenPage';
import PlantDetailPage from './pages/PlantDetailPage';
import PlantDoctorPage from './pages/PlantDoctorPage';
import GardenCoachPage from './pages/GardenCoachPage';
import MissionsPage from './pages/MissionsPage';
import JournalPage from './pages/JournalPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <GardenProvider>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<HomePage />} />
              <Route path="garden" element={<GardenPage />} />
              <Route path="garden/:id" element={<PlantDetailPage />} />
              <Route path="plant-doctor" element={<PlantDoctorPage />} />
              <Route path="coach" element={<GardenCoachPage />} />
              <Route path="missions" element={<MissionsPage />} />
              <Route path="journal" element={<JournalPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </GardenProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}
