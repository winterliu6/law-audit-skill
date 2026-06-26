import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext, useAuthState } from '@/hooks/useAuth';
import MainLayout from '@/layouts/MainLayout';
import Home from '@/pages/Home';
import Audit from '@/pages/Audit';
import Dashboard from '@/pages/Dashboard';
import History from '@/pages/History';
import ContractTemplate from '@/pages/ContractTemplate';
import Admin from '@/pages/Admin';

function App() {
  const auth = useAuthState();

  return (
    <AuthContext.Provider value={auth}>
      <BrowserRouter>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/audit" element={<Audit />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/history" element={<History />} />
            <Route path="/contract-template" element={<ContractTemplate />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}

export default App;
