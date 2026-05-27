import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext.jsx";
import PinLock from "./auth/PinLock.jsx";
import AdminSetup from "./auth/AdminSetup.jsx";
import AppLayout from "./layout/AppLayout.jsx";
import POSPage from "./pages/POSPage.jsx";
import MenuManagement from "./pages/MenuManagement.jsx";
import TableManagement from "./pages/TableManagement.jsx";
import Members from "./pages/Members.jsx";
import Orders from "./pages/Orders.jsx";
import Reservations from "./pages/Reservations.jsx";
import Stock from "./pages/Stock.jsx";
import PointsRewards from "./pages/PointsRewards.jsx";
import PaymentQR from "./pages/PaymentQR.jsx";
import BillRequest from "./pages/BillRequest.jsx";
import Settings from "./pages/Settings.jsx";
import CustomerOrder from "./pages/CustomerOrder.jsx";
import PrintQR from "./pages/PrintQR.jsx";
import ShiftPage from "./pages/ShiftPage.jsx";
import Employees from "./pages/Employees.jsx";
import Reports from "./pages/Reports.jsx";
import Timeclock from "./pages/Timeclock.jsx";
import KDS from "./pages/KDS.jsx";
import BarcodePrint from "./pages/BarcodePrint.jsx";

function AdminRoutes() {
  const { authed, checking, firstRun, onSetupDone } = useAuth();
  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-cream">
        <div className="text-sm text-gray-400">กำลังตรวจสอบสิทธิ์...</div>
      </div>
    );
  }
  if (firstRun) return <AdminSetup onDone={onSetupDone} />;
  if (!authed) return <PinLock />;

  return (
    <Routes>
      <Route path="/print-qr" element={<PrintQR />} />
      <Route path="/kds" element={<KDS />} />
      <Route element={<AppLayout />}>
        <Route path="/" element={<POSPage />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/menu" element={<MenuManagement />} />
        <Route path="/tables" element={<TableManagement />} />
        <Route path="/members" element={<Members />} />
        <Route path="/employees" element={<Employees />} />
        <Route path="/timeclock" element={<Timeclock />} />
        <Route path="/shift" element={<ShiftPage />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/reservations" element={<Reservations />} />
        <Route path="/stock" element={<Stock />} />
        <Route path="/barcodes" element={<BarcodePrint />} />
        <Route path="/points-manage" element={<PointsRewards />} />
        <Route path="/payment-qr" element={<PaymentQR />} />
        <Route path="/bill-history" element={<BillRequest />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/order" element={<CustomerOrder />} />
      <Route
        path="*"
        element={
          <AuthProvider>
            <AdminRoutes />
          </AuthProvider>
        }
      />
    </Routes>
  );
}
