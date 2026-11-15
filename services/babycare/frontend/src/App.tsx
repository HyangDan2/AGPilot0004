import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { ChildProvider } from './context/ChildContext';
import { AppLayout } from './components/layout/AppLayout';

import { DashboardPage } from './pages/DashboardPage';
import { GrowthPage } from './pages/GrowthPage';
import { CareTrackerPage } from './pages/CareTrackerPage';
import { CalendarPage } from './pages/CalendarPage';
import { KnowledgePage } from './pages/KnowledgePage';
import { AIAssistantPage } from './pages/AIAssistantPage';
import { FamilyPage } from './pages/FamilyPage';
import { LoginPage } from './pages/LoginPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ChildProvider>
          <BrowserRouter basename={import.meta.env.BASE_URL}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<AppLayout />}>
                <Route index element={<DashboardPage />} />
                <Route path="growth" element={<GrowthPage />} />
                <Route path="care" element={<CareTrackerPage />} />
                <Route path="calendar" element={<CalendarPage />} />
                <Route path="knowledge" element={<KnowledgePage />} />
                <Route path="ai" element={<AIAssistantPage />} />
                <Route path="family" element={<FamilyPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </ChildProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
